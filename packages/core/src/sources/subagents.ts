/**
 * Discovers and reads subagent JSONL files. I/O.
 *
 *   <session-id>/subagents/agent-<uuid>.jsonl
 *
 * Each agent file is appended to by the agent's transcript as it works.
 * We treat the file mtime as the cheap proxy for "is this agent still
 * alive?" and tail the file (last 256 KB only) for model / context /
 * activity.
 *
 * Caching: results are kept by `(path, mtimeMs)`. On a hit we return the
 * memoised `SubAgent` without reading the file. The cache lives on the
 * factory closure so two `createCollector` instances never share state.
 *
 * Sequential claim: when two sessions fall back to the same transcript
 * (rare but real on this user's 15-session machine), the first one to
 * claim the `subagents/` directory wins — cctop's `attachSubagentsInOrder`
 * pattern, generalised to a `Set<string>` of claimed directories passed
 * in by the caller (the orchestrator).
 */

import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  isSubagentLive,
  parseSubagentTail,
} from "../domain/subagent.js";
import type { SubAgent } from "../types.js";

const TAIL_BYTES = 256 * 1024; // 256 KB — plenty for the latest assistant turn

export interface SubagentSource {
  /**
   * List live subagents under `<transcriptDir>/<sessionId>/subagents/`.
   * `claimedDirs` is a shared `Set<string>` mutated in place: the
   * directory's name is added before any read so concurrent collectors
   * skip it. (No-op on the single-collector path.)
   */
  listLive(
    transcriptDir: string,
    sessionId: string | null,
    nowMs: number,
    claimedDirs?: Set<string>,
  ): Promise<SubAgent[]>;
}

interface CacheEntry {
  mtimeMs: number;
  agent: SubAgent;
}

export function createNodeSubagentSource(): SubagentSource {
  // Per-source cache. Two collector instances have two caches.
  const cache = new Map<string, CacheEntry>();

  async function readTail(path: string): Promise<string> {
    const fh = await open(path, "r").catch(() => null);
    if (!fh) return "";
    try {
      const st = await fh.stat();
      const size = st.size;
      if (!size) return "";
      const start = size > TAIL_BYTES ? size - TAIL_BYTES : 0;
      const length = size - start;
      const buf = Buffer.alloc(length);
      await fh.read(buf, 0, length, start);
      return buf.toString("utf8");
    } finally {
      await fh.close();
    }
  }

  return {
    async listLive(
      transcriptDir,
      sessionId,
      nowMs,
      claimedDirs,
    ): Promise<SubAgent[]> {
      if (!sessionId) return [];
      const dir = join(transcriptDir, sessionId, "subagents");

      // Sequential claim: the first caller for this dir wins. Subsequent
      // callers skip the read entirely.
      if (claimedDirs?.has(dir)) return [];
      claimedDirs?.add(dir);

      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return [];
      }

      const candidates = entries.filter(
        (e) => e.startsWith("agent-") && e.endsWith(".jsonl"),
      );

      const out: SubAgent[] = [];
      for (const file of candidates) {
        const full = join(dir, file);
        const st = await stat(full).catch(() => null);
        if (!st) continue;

        // Fast path: cached entry whose mtime hasn't moved.
        const cached = cache.get(full);
        if (cached && cached.mtimeMs === st.mtimeMs) {
          // Still need to check liveness: the cache holds the last-seen
          // status, but age has advanced. Recompute quickly.
          if (isSubagentLive({ mtimeMs: st.mtimeMs, nowMs, running: false })) {
            out.push(cached.agent);
          }
          continue;
        }

        // Cache miss or stale. Tail-read, parse, cache.
        const tail = await readTail(full).catch(() => "");
        if (!tail) continue;
        const lines = tail.split("\n").slice(-64);
        const ctx = parseSubagentTail(lines);

        const live = isSubagentLive({
          mtimeMs: st.mtimeMs,
          nowMs,
          running: ctx.running,
        });
        if (!live) continue;

        const agent: SubAgent = {
          model: ctx.model,
          ctx: ctx.ctx,
          activity: ctx.activity,
          uptimeSec: Math.max(0, Math.floor((nowMs - st.birthtimeMs) / 1000)),
        };
        cache.set(full, { mtimeMs: st.mtimeMs, agent });
        out.push(agent);
      }

      out.sort((a, b) => (b.ctx ?? 0) - (a.ctx ?? 0));
      return out;
    },
  };
}