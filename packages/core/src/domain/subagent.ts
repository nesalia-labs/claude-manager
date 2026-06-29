/**
 * Pure helpers for subagent parsing. No I/O.
 *
 * A subagent's transcript sits at:
 *   ~/.claude/projects/<encoded-cwd>/<session-id>/subagents/agent-<uuid>.jsonl
 *
 * Every entry has `isSidechain: true`. The newest assistant turn gives us
 * model + context size; the last entry tells us whether the agent is
 * mid-flight (still has tool_use/tool_result pending).
 */

import { contextTokens, describeAssistant } from "./tool.js";

export interface SubagentContext {
  model: string | null;
  ctx: number | null;
  activity: string | null;
  running: boolean;
}

const HAS_BLOCK = (msg: unknown, type: string): boolean =>
  Array.isArray((msg as { content?: unknown } | undefined)?.content) &&
  ((msg as { content: unknown[] }).content as unknown[]).some(
    (b): b is { type?: unknown } =>
      typeof b === "object" && b !== null && (b as { type?: unknown }).type === type,
  );

/**
 * Tail-walk a subagent's JSONL and return its model/context/activity.
 * Reads the last `MAX_TAIL_BYTES` (mirrors the main transcript reader).
 */
export function parseSubagentTail(
  rawLines: readonly string[],
  maxTailBytes = 4 * 1024 * 1024,
): SubagentContext {
  const out: SubagentContext = {
    model: null,
    ctx: null,
    activity: null,
    running: false,
  };

  // Read only the tail of the file. We walk from the end so the newest
  // assistant turn wins; we need every line for the running-flag check.
  // For memory safety, we approximate the tail by counting bytes from the
  // end; the caller is responsible for passing only the last few KB of
  // lines, or this loops over the whole file.
  let bytes = 0;
  const recent: string[] = [];
  for (let i = rawLines.length - 1; i >= 0; i--) {
    const line = rawLines[i];
    if (line === undefined) break;
    bytes += line.length + 1;
    if (bytes > maxTailBytes) break;
    recent.unshift(line);
  }

  let lastEntry: Record<string, unknown> | null = null;
  for (const line of recent) {
    if (!line) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    lastEntry = entry;
    if (
      entry.type === "assistant" &&
      entry.message &&
      typeof (entry.message as Record<string, unknown>)["usage"] === "object"
    ) {
      const msg = entry.message as {
        model?: string;
        usage?: Record<string, number>;
        content?: unknown;
      };
      if (msg.model && msg.model !== "<synthetic>") {
        out.model = msg.model;
        out.ctx = contextTokens(msg.usage);
        out.activity = describeAssistant(msg);
      }
    }
  }

  // Mid-flight detection: the last entry is either an assistant turn with
  // a tool_use block still pending, or a user turn whose content is a
  // tool_result block — the agent is awaiting the next turn.
  if (lastEntry) {
    const lastMsg = lastEntry.message;
    if (
      lastEntry.type === "assistant" &&
      HAS_BLOCK(lastMsg, "tool_use")
    ) {
      out.running = true;
    } else if (
      lastEntry.type === "user" &&
      HAS_BLOCK(lastMsg, "tool_result")
    ) {
      out.running = true;
    }
  }

  return out;
}

/**
 * Whether a subagent is considered live given its mtime age.
 *
 * - `SUBAGENT_LIVE_MS = 20s` — recently wrote a turn, definitely live.
 * - `SUBAGENT_BUSY_MS = 180s` (3 min) AND mid-flight — quietly running a tool.
 * - Otherwise: not live, drop.
 */
export function isSubagentLive(args: {
  mtimeMs: number;
  nowMs: number;
  running: boolean;
}): boolean {
  const SUBAGENT_LIVE_MS = 20_000;
  const SUBAGENT_BUSY_MS = 180_000;
  const age = args.nowMs - args.mtimeMs;
  if (age < SUBAGENT_LIVE_MS) return true;
  if (age < SUBAGENT_BUSY_MS && args.running) return true;
  return false;
}