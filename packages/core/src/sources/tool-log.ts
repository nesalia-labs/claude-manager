/**
 * Tool log source. I/O — reads the tail of a session's transcript and
 * extracts the chronological tool_use + tool_result pairs.
 *
 * Pure parsing lives in `domain/tool-log.ts`. This module owns the FS.
 */

import { stat } from "node:fs/promises";
import { open } from "node:fs/promises";

import { parseToolLog } from "../domain/tool-log.js";
import type { ToolLogEntry } from "../types.js";

const TAIL_BYTES = 512 * 1024; // 512 KB tail is plenty for the most recent tool calls

export interface ToolLogSource {
  /** Read the most recent tool log entries from the session transcript. */
  read(
    path: string,
    mtimeMs: number,
    maxEntries?: number,
  ): Promise<ToolLogEntry[]>;
}

export function createNodeToolLogSource(): ToolLogSource {
  return {
    async read(path, mtimeMs, maxEntries = 50): Promise<ToolLogEntry[]> {
      let size: number;
      try {
        size = (await stat(path)).size;
      } catch {
        return [];
      }
      if (!size) return [];

      const fh = await open(path, "r").catch(() => null);
      if (!fh) return [];
      try {
        const start = size > TAIL_BYTES ? size - TAIL_BYTES : 0;
        const length = size - start;
        const buf = Buffer.alloc(length);
        await fh.read(buf, 0, length, start);
        const text = buf.toString("utf8");
        return parseToolLog(text, maxEntries, mtimeMs);
      } finally {
        await fh.close();
      }
    },
  };
}