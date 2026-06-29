/**
 * Test helpers for unit tests in core. Reachable only via
 * `@claude-manager/core/internal/__test-helpers` — never bundled with the
 * default import path.
 */

import type { Details } from "../domain/transcript.js";

/**
 * Build a JSONL string from an array of plain objects. Trailing newline
 * matches Claude Code's on-disk format.
 */
export const jsonl = (entries: readonly unknown[]): string =>
  `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;

/** Build an `assistant` transcript entry. */
export const assistant = (
  model: string,
  usage: Record<string, number>,
  content: ReadonlyArray<Record<string, unknown>> = [],
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: "assistant",
  message: { model, usage, content },
  ...extra,
});

/** Build a `user` transcript entry. Content can be a string or a block array. */
export const user = (
  content: string | ReadonlyArray<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: "user",
  message: { content },
  ...extra,
});

/** Re-export `Details` for tests that build fixtures. */
export type { Details };
