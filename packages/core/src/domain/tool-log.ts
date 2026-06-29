/**
 * Pure tool-log parser. No I/O.
 *
 * Reads the tail of a session transcript as a single string, splits it
 * into JSONL lines, and walks them to build chronological `ToolLogEntry`s.
 *
 * State model:
 *   - For each `assistant.message.content[]` `tool_use` block, we emit a
 *     `pending` entry.
 *   - When a later `user.message.content[]` `tool_result` block with the
 *     matching `tool_use_id` is seen, we transition the entry to `done`
 *     or `error` (based on `is_error`).
 *   - We keep only the last `maxEntries` entries (most recent first).
 */

import type { ToolLogEntry } from "../types.js";

interface MutableEntry {
  toolUseId: string;
  tool: string;
  target: string;
  status: "pending" | "done" | "error";
  atMs: number;
  durationMs?: number;
}

export function parseToolLog(
  text: string,
  maxEntries: number,
  fallbackMtimeMs: number,
): ToolLogEntry[] {
  const lines = text.split("\n");

  // Map of tool_use_id → pending entry index in the mutable array.
  const pending = new Map<string, number>();
  // Chronological entries; built as mutable then frozen at the end.
  const results: MutableEntry[] = [];

  for (const line of lines) {
    if (!line) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = typeof entry["timestamp"] === "string"
      ? Date.parse(entry["timestamp"] as string)
      : Number.NaN;
    const atMs = Number.isNaN(ts) ? fallbackMtimeMs : ts;

    if (
      entry.type === "assistant" &&
      entry.isSidechain !== true &&
      entry.message &&
      Array.isArray((entry.message as { content?: unknown }).content)
    ) {
      const content = (entry.message as { content: unknown[] }).content;
      for (const block of content) {
        if (
          typeof block === "object" &&
          block !== null &&
          (block as { type?: unknown }).type === "tool_use"
        ) {
          const b = block as {
            id?: unknown;
            name?: unknown;
            input?: Record<string, unknown>;
          };
          if (typeof b.id !== "string") continue;
          const target = describeToolUse(
            typeof b.name === "string" ? b.name : "?",
            b.input,
          );
          const idx = results.length;
          results.push({
            toolUseId: b.id,
            tool: typeof b.name === "string" ? b.name : "?",
            target,
            status: "pending",
            atMs,
          });
          pending.set(b.id, idx);
        }
      }
    } else if (
      entry.type === "user" &&
      entry.isSidechain !== true &&
      entry.message &&
      Array.isArray((entry.message as { content?: unknown }).content)
    ) {
      const content = (entry.message as { content: unknown[] }).content;
      for (const block of content) {
        if (
          typeof block === "object" &&
          block !== null &&
          (block as { type?: unknown }).type === "tool_result"
        ) {
          const b = block as { tool_use_id?: unknown; is_error?: unknown };
          if (typeof b.tool_use_id !== "string") continue;
          const idx = pending.get(b.tool_use_id);
          if (idx === undefined) continue;
          const existing = results[idx];
          if (!existing) continue;
          existing.status = b.is_error === true ? "error" : "done";
          existing.durationMs = Math.max(0, atMs - existing.atMs);
          pending.delete(b.tool_use_id);
        }
      }
    }
  }

  // Sort newest first, cap to maxEntries, freeze as readonly ToolLogEntry.
  results.sort((a, b) => b.atMs - a.atMs);
  return results.slice(0, maxEntries) as ToolLogEntry[];
}

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit"]);

function describeToolUse(name: string, input: Record<string, unknown> | undefined): string {
  if (!input) return name;
  const arg = String(
    input["command"] ??
      input["pattern"] ??
      input["query"] ??
      input["url"] ??
      input["file_path"] ??
      input["path"] ??
      input["description"] ??
      input["subagent_type"] ??
      "",
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (FILE_TOOLS.has(name) && arg.includes("/")) {
    const last = arg.split("/").pop();
    return last ? `${name}: ${last}` : name;
  }
  return arg ? `${name}: ${arg}` : name;
}