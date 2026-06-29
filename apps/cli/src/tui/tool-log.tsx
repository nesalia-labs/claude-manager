/**
 * Tool log panel — chronological stream of tool_use + tool_result pairs
 * for the focused session. Newest entries at the top.
 *
 * Status glyphs:
 *   ⠿  pending (tool_use emitted, no result yet)
 *   ✓   done
 *   ✗   error
 */

import type { ToolLogEntry } from "@claude-manager/core";

interface ToolLogPanelProps {
  entries: readonly ToolLogEntry[];
}

const STATUS_COLORS: Record<ToolLogEntry["status"], string> = {
  pending: "#e0af68",
  done: "#9ece6a",
  error: "#f7768e",
};

const STATUS_GLYPHS: Record<ToolLogEntry["status"], string> = {
  pending: "⠿",
  done: "✓",
  error: "✗",
};

function fmtDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function fmtTime(atMs: number): string {
  return new Date(atMs).toISOString().slice(11, 19); // HH:MM:SS
}

export function ToolLogPanel({ entries }: ToolLogPanelProps): React.ReactNode {
  if (entries.length === 0) {
    return (
      <box flexDirection="column" width="100%">
        <text fg="#565f89">{"  (no tool calls)"}</text>
      </box>
    );
  }
  return (
    <box flexDirection="column" width="100%">
      <text fg="#bb9af7">{`  Tool log (${entries.length})`}</text>
      {entries.map((e, idx) => (
        <box
          key={`${e.toolUseId}-${idx}`}
          flexDirection="row"
          width="100%"
          paddingLeft={4}
        >
          <text fg={STATUS_COLORS[e.status]}>{`${STATUS_GLYPHS[e.status]} `}</text>
          <text fg="#565f89">{fmtTime(e.atMs)}</text>
          <text fg="#565f89">{"  "}</text>
          <text fg="#c0caf5">{e.target.padEnd(48)}</text>
          <text fg="#565f89">{e.status === "pending" ? "…" : ` ${fmtDuration(e.durationMs)}`}</text>
        </box>
      ))}
    </box>
  );
}