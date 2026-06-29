/**
 * Pure helpers over a JSONL transcript entry. No I/O.
 *
 * Used by `sources/transcript.ts` to incrementally accumulate what we know
 * about a session while walking backwards through the tail.
 */

import { contextTokens, describeAssistant } from "./tool.js";

/** Intermediate accumulator; never escapes the file reader. */
export interface Details {
  branch?: string;
  model?: string;
  ctx?: number;
  prompt?: string;
  promptAt?: number; // unix ms of the last user prompt
  lastTurn?: string;
  /** Most recent text content the assistant produced (last "message"). */
  lastMessage?: string;
}

const LAST_MESSAGE_MAX = 500;

function extractLastText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  // Walk blocks in reverse; concatenate contiguous `text` blocks, stopping
  // at the first non-text block (so a tool_use doesn't fragment the
  // surrounding prose).
  let buf = "";
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i] as { type?: unknown; text?: unknown };
    if (!block || typeof block !== "object") return null;
    if (block.type !== "text") {
      // First non-text block: cap the buffer we've collected.
      break;
    }
    const t = block.text;
    if (typeof t === "string" && t.length > 0) {
      buf = t.length > buf.length ? t : t + (buf ? "\n" + buf : "");
    }
  }
  if (!buf) return null;
  // Collapse whitespace and clamp.
  const flat = buf.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  return flat.length > LAST_MESSAGE_MAX
    ? flat.slice(0, LAST_MESSAGE_MAX - 1) + "…"
    : flat;
}

const PROMPT_MAX = 2048;

/**
 * Apply an entry to the in-progress `details`. Mutates the provided
 * accumulator. Stops being interesting once `details` knows model + prompt
 * + branch; the caller can check that and return early.
 */
export function noteEntry(details: Details, entry: Record<string, unknown>): void {
  const e = entry;
  const type = e["type"];

  // gitBranch: first entry that has one wins.
  if (details.branch === undefined) {
    const branch = e["gitBranch"];
    if (typeof branch === "string") details.branch = branch;
  }

  // Last non-sidechain, non-synthetic, non-isMeta assistant turn gives us
  // model + context size + last-turn label.
  if (type === "assistant" && e["isSidechain"] !== true) {
    const message = e["message"] as
      | { usage?: Record<string, number>; model?: string; content?: unknown }
      | undefined;
    const usage = message?.usage;
    const model = message?.model;
    if (usage && model && model !== "<synthetic>") {
      if (!details.model) {
        details.model = model;
        details.ctx = contextTokens(usage);
        const label = describeAssistant(message);
        if (label !== null) details.lastTurn = label;
      }
      // Most recent assistant text content (the last message the agent
      // produced). Stripped of newlines + truncated to 500 chars.
      const text = extractLastText(message?.content);
      if (text) {
        details.lastMessage = text;
      }
    }
  }

  // Last user prompt from the main thread (no isMeta, no isSidechain).
  if (
    type === "user" &&
    e["isMeta"] !== true &&
    e["isSidechain"] !== true &&
    !details.prompt
  ) {
    const message = e["message"] as { content?: unknown } | undefined;
    const content = message?.content;
    let text: string | null = null;
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      const block = content.find(
        (b): b is { type: string; text?: string } =>
          typeof b === "object" &&
          b !== null &&
          (b as { type?: unknown }).type === "text",
      );
      text = block?.text ?? null;
    }
    if (text) {
      // Slash commands arrive wrapped in <command-name>/<command-args>.
      const cmdMatch = text.match(/<command-name>([^<]*)<\/command-name>/);
      if (cmdMatch) {
        const argsMatch = text.match(/<command-args>([^<]*)<\/command-args>/);
        text = `${cmdMatch[1] ?? ""} ${argsMatch?.[1] ?? ""}`;
      }
      text = text.replace(/\s+/g, " ").trim();
      // Skip harness wrappers like <local-command-stdout>
      if (text && !text.startsWith("<")) {
        details.prompt = text.slice(0, PROMPT_MAX);
        const ts = e["timestamp"];
        if (typeof ts === "string") {
          const parsed = Date.parse(ts);
          if (!Number.isNaN(parsed)) details.promptAt = parsed;
        }
      }
    }
  }
}

/** All fields known → can stop walking backwards. */
export function detailsAreComplete(d: Details): boolean {
  return d.model !== undefined && d.prompt !== undefined && d.branch !== undefined;
}
