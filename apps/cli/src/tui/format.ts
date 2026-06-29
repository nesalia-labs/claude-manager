/**
 * Shared display formatters for the TUI. Single source of truth for status
 * colours/glyphs and the project-/session-/tool-level number formatters
 * (`fmtContext`, `fmtAgo`, `truncate`). Anything that another panel might
 * re-render — and that diverging implementations would visually desync —
 * lives here.
 */

import type { Instance, ToolLogEntry } from "@claude-manager/core";

// -- Instance status (running / idle / done) ---------------------------------

export const STATUS_COLORS: Record<Instance["status"], string> = {
  running: "#9ece6a",
  idle: "#e0af68",
  done: "#565f89",
};

export const STATUS_GLYPHS: Record<Instance["status"], string> = {
  running: "●",
  idle: "○",
  done: "·",
};

// -- Tool log status (pending / done / error) -------------------------------

export const TOOL_STATUS_COLORS: Record<ToolLogEntry["status"], string> = {
  pending: "#e0af68",
  done: "#9ece6a",
  error: "#f7768e",
};

export const TOOL_STATUS_GLYPHS: Record<ToolLogEntry["status"], string> = {
  pending: "⠿",
  done: "✓",
  error: "✗",
};

// -- Numbers ----------------------------------------------------------------

/** "12345" → "12k tokens", "1234567" → "1.2M tokens", null → "?". */
export function fmtContext(n: number | null): string {
  if (n === null) return "?";
  if (n < 1000) return `${n} tokens`;
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k.toFixed(k < 10 ? 1 : 0)}k tokens`;
  }
  return `${(n / 1_000_000).toFixed(1)}M tokens`;
}

/** "1500ms ago" → "now", "120000ms ago" → "2m ago". */
export function fmtAgo(ms: number, now: number): string {
  const d = Math.max(0, now - ms);
  if (d < 1000) return "now";
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** "very long string…" → truncate to `n` chars with a trailing ellipsis. */
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`;
}
