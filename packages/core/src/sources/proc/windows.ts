/**
 * Windows process source — `tasklist /FO CSV /NH` subprocess.
 *
 * V0 deliberately avoids FFI to ntdll/iphlpapi (Sentinel One EDR + no
 * admin on the dev machine). Each call spawns `tasklist.exe` which
 * walks every process on the box and prints CSV — measured at 50–250 ms
 * on a busy Windows dev host.
 *
 * To make this affordable at a 1 s tick, the snapshot is cached for a
 * short TTL (default 2 s). At a 1 s tick that's roughly one cached hit
 * per real tick, and one fresh read every other tick — 50 % cost cut with
 * no observable staleness for our use (process liveness is a coarse
 * signal anyway).
 */

import { spawnSync } from "node:child_process";

import type { Proc, ProcSource } from "./types.js";

const DEFAULT_TTL_MS = 2000;

const BOM_MARK = "﻿";

export interface WindowsProcOptions {
  /** TTL in ms for the cached `tasklist` snapshot. Default 2000. */
  ttlMs?: number;
}

export function createWindowsProcSource(
  options: WindowsProcOptions = {},
): ProcSource {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  let cached: { atMs: number; byPid: Map<number, Proc> } | null = null;

  function refresh(): { atMs: number; byPid: Map<number, Proc> } {
    const r = spawnSync("tasklist", ["/FO", "CSV", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (r.status !== 0 || !r.stdout) {
      cached = { atMs: Date.now(), byPid: new Map() };
      return cached;
    }
    const out: Proc[] = [];
    for (const line of r.stdout.split(/\r?\n/)) {
      if (!line) continue;
      const cleaned = line.startsWith(BOM_MARK) ? line.slice(1) : line;
      const cols = parseCsvLine(cleaned);
      if (cols.length < 5) continue;
      const pid = Number(cols[1]);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      out.push({
        pid,
        ppid: 0,
        rss: parseMemUsage(cols[4]),
        cpuSec: 0,
        startSec: 0,
        path: null,
        name: cols[0]?.replace(/\.exe$/i, "") ?? "?",
        uid: -1,
      });
    }
    const byPid = new Map(out.map((p) => [p.pid, p]));
    cached = { atMs: Date.now(), byPid };
    return cached;
  }

  return {
    async list(): Promise<Proc[]> {
      const now = Date.now();
      if (cached && now - cached.atMs < ttlMs) {
        return [...cached.byPid.values()];
      }
      const fresh = refresh();
      return [...fresh.byPid.values()];
    },
    async cwdOf(_pid: number): Promise<string | null> {
      return null;
    },
    async close(): Promise<void> {
      cached = null;
    },
  };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseMemUsage(raw: string | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, "");
  const kb = Number(digits);
  return Number.isFinite(kb) ? kb * 1024 : 0;
}

export const __test = { parseCsvLine, parseMemUsage };