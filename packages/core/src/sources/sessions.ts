/**
 * Reads the per-PID session registry under `~/.claude/sessions/`.
 * Read-only. Per-PID file validation is the pure `parseSession`.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseSession } from "../domain/session.js";

export interface SessionsSource {
  /** Read all `<pid>.json` entries in the registry. */
  read(): Promise<Map<number, Awaited<ReturnType<typeof parseSession>>>>;
}

export function createSessionsDir(claudeDir: string): string {
  return join(claudeDir, "sessions");
}

export function createNodeSessionsSource(claudeDir: string): SessionsSource {
  return {
    async read() {
      const out = new Map<number, Awaited<ReturnType<typeof parseSession>>>();
      const dir = createSessionsDir(claudeDir);
      let files: string[];
      try {
        files = await readdir(dir);
      } catch {
        return out; // missing or unreadable → empty map
      }
      await Promise.all(
        files.map(async (file) => {
          if (!/^\d+\.json$/.test(file)) return;
          try {
            const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
            const session = parseSession(raw, file);
            if (session && session.pid !== undefined) out.set(session.pid, session);
          } catch {
            // missing or malformed → skip
          }
        }),
      );
      return out;
    },
  };
}
