/**
 * JSONL transcript tail reader. Read-only.
 *
 * The I/O layer; parsing lives in `domain/transcript.ts`. Caches parsed
 * details by `path + mtimeMs` so an idle session is not re-scanned every
 * refresh tick. The cache lives inside the returned `read` closure so
 * nothing is shared across Collector instances.
 */

import { open } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  type Details,
  detailsAreComplete,
  noteEntry,
} from "../domain/transcript.js";

export interface TranscriptSource {
  /** Read the latest details from a transcript file. */
  read(path: string): Promise<{ mtimeMs: number; details: Details }>;
  /** Discover the most recent <id>.jsonl for a project cwd. */
  discover(cwd: string, sinceMs: number): Promise<string | null>;
  /** Drop cached entries whose paths are not in `keep`. */
  prune(keep: ReadonlySet<string>): void;
}

const TAIL_CHUNK = 256 * 1024; // 256 KB
const MAX_TAIL_BYTES = 4 * 1024 * 1024; // 4 MB hard cap

interface CacheEntry {
  mtimeMs: number;
  details: Details;
}

/**
 * Factory. `claudeDir` is the resolved Claude data directory; project
 * transcripts live under `${claudeDir}/projects/<encoded-cwd>/<id>.jsonl`.
 */
export function createNodeTranscriptSource(claudeDir: string): TranscriptSource {
  const cache = new Map<string, CacheEntry>();

  const projectDir = (cwd: string): string =>
    join(claudeDir, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));

  async function readTail(path: string): Promise<{
    mtimeMs: number;
    details: Details;
  }> {
    const st = await stat(path).catch(() => null);
    if (!st) return { mtimeMs: 0, details: {} };
    const mtimeMs = st.mtimeMs;
    if (!st.size) return { mtimeMs, details: {} };

    const cached = cache.get(path);
    if (cached && cached.mtimeMs === mtimeMs) return { mtimeMs, details: cached.details };

    const details: Details = {};
    const fh = await open(path, "r").catch(() => null);
    if (!fh) return { mtimeMs, details };

    try {
      const size = st.size;
      let carry: Buffer = Buffer.alloc(0);
      let end = size;
      while (end > 0 && size - end < MAX_TAIL_BYTES) {
        const start = Math.max(0, end - TAIL_CHUNK);
        const length = end - start;
        const buf = Buffer.alloc(length);
        await fh.read(buf, 0, length, start);
        const block = carry.length === 0 ? buf : Buffer.concat([buf, carry]);
        let parseFrom = 0;
        if (start > 0) {
          const nl = block.indexOf(10);
          if (nl < 0) {
            carry = block;
            end = start;
            continue;
          }
          carry = block.subarray(0, nl);
          parseFrom = nl + 1;
        }
        const lines = block.subarray(parseFrom).toString("utf8").split("\n");
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (!line) continue;
          let entry: Record<string, unknown>;
          try {
            entry = JSON.parse(line);
          } catch {
            continue; // partial line being written
          }
          noteEntry(details, entry);
          if (detailsAreComplete(details)) {
            cache.set(path, { mtimeMs, details });
            return { mtimeMs, details };
          }
        }
        end = start;
      }
    } finally {
      await fh.close();
    }
    cache.set(path, { mtimeMs, details });
    return { mtimeMs, details };
  }

  return {
    read: readTail,
    async discover(cwd: string, sinceMs: number): Promise<string | null> {
      const dir = projectDir(cwd);
      let best: { path: string; mtimeMs: number } | null = null;
      try {
        const files = await readdir(dir);
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const full = join(dir, file);
          const st = await stat(full).catch(() => null);
          if (!st) continue;
          if (st.mtimeMs < sinceMs - 60_000) continue;
          if (!best || st.mtimeMs > best.mtimeMs) {
            best = { path: full, mtimeMs: st.mtimeMs };
          }
        }
      } catch {
        return null;
      }
      return best?.path ?? null;
    },
    prune(keep: ReadonlySet<string>): void {
      for (const path of cache.keys()) {
        if (!keep.has(path)) cache.delete(path);
      }
    },
  };
}
