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
  if (type === "assistant" && e["isSidechain"] !== true && !details.model) {
    const message = e["message"] as
      | { usage?: Record<string, number>; model?: string }
      | undefined;
    const usage = message?.usage;
    const model = message?.model;
    if (usage && model && model !== "<synthetic>") {
      details.model = model;
      details.ctx = contextTokens(usage);
      const label = describeAssistant(message);
      if (label !== null) details.lastTurn = label;
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
