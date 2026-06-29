/**
 * Project-grouped session list with selection.
 *
 * Wrapped in `<scrollbox>` so the list scrolls when it exceeds the
 * terminal height. `width="50%"` carves the panel in two with
 * `<SessionDetail>`; `stickyScroll` keeps new entries visible at the
 * bottom for live-tail behaviour.
 */

import type { Instance } from "@claude-manager/core";

import { STATUS_COLORS, STATUS_GLYPHS, fmtAgo, fmtContext } from "./format.js";

interface ProjectGroup {
  project: string;
  instances: Instance[];
  expanded: boolean;
}

interface ProjectListProps {
  grouped: ProjectGroup[];
  cursor: number;
  /** O(1) pid → flat-row-index lookup. Built once per flatRows change. */
  pidToFlatIndex: ReadonlyMap<number, number>;
  selectedPid: number | null;
  onCursorChange: (next: number) => void;
  onSelectPid: (pid: number | null) => void;
  /** When true, take the full width (no SessionDetail beside). */
  fullWidth?: boolean;
  /** True when the snapshot has zero sessions — render a centered empty state. */
  empty?: boolean;
}

export function ProjectList({
  grouped,
  cursor,
  pidToFlatIndex,
  selectedPid,
  onCursorChange,
  onSelectPid,
  fullWidth,
  empty,
}: ProjectListProps): React.ReactNode {
  if (empty) {
    return (
      <box
        flexDirection="column"
        width="100%"
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
      >
        <text fg="#565f89">{"  no Claude Code sessions running."}</text>
        <text fg="#414868">{"  start one and it'll appear here."}</text>
      </box>
    );
  }
  // Single timestamp per render — avoids calling Date.now() once per row.
  const now = Date.now();
  return (
    <scrollbox
      focused
      stickyScroll
      width={fullWidth ? "100%" : "50%"}
      flexGrow={1}
      paddingLeft={1}
      paddingRight={1}
      scrollbarOptions={{ showArrows: false }}
    >
      {grouped.map((group) => (
        <box key={group.project} flexDirection="column" width="100%">
          <box flexDirection="row" width="100%">
            <text fg="#7dcfff">{group.expanded ? "▾ " : "▸ "}</text>
            <text fg="#c0caf5">{group.project}</text>
            <text fg="#565f89">{`  (${group.instances.length})`}</text>
          </box>
          {group.expanded
            ? group.instances.map((inst) => {
                const rowIndex = pidToFlatIndex.get(inst.pid) ?? -1;
                const isCursor = rowIndex === cursor;
                const isSelected = selectedPid === inst.pid;
                const color = STATUS_COLORS[inst.status];
                const glyph = STATUS_GLYPHS[inst.status];
                return (
                  <box
                    key={inst.pid}
                    flexDirection="row"
                    width="100%"
                    paddingLeft={4}
                    onMouseDown={() => {
                      onCursorChange(rowIndex);
                      onSelectPid(inst.pid);
                    }}
                  >
                    <text fg={isCursor || isSelected ? "#bb9af7" : "#1f2335"}>
                      {isCursor ? "▶ " : "  "}
                    </text>
                    <text fg={color}>{glyph} </text>
                    <text fg={isSelected ? "#bb9af7" : "#c0caf5"}>
                      {shortModel(inst.model)}
                    </text>
                    <text fg="#565f89">{"  "}</text>
                    <text fg="#a9b1d6">{shortPath(inst.project)}</text>
                    <text fg="#565f89">{"  "}</text>
                    <text fg="#bb9af7">{fmtContext(inst.contextTokens)}</text>
                    <text fg="#565f89">{"  ·  "}</text>
                    <text fg="#565f89">{fmtAgo(inst.lastMs, now)}</text>
                  </box>
                );
              })
            : null}
        </box>
      ))}
      {grouped.length === 0 ? (
        <text fg="#565f89">{"  no sessions running"}</text>
      ) : null}
    </scrollbox>
  );
}

/** "MiniMax-M3" → "M-M3", "claude-sonnet-4-5-20260101" → "sonnet-4-5". */
function shortModel(model: string | null): string {
  if (!model) return "?";
  // Drop trailing date stamps (8-digit suffix).
  const m = model.replace(/-\d{8}$/, "");
  // If the prefix is "claude-", keep "claude-X" for clarity; otherwise
  // drop the longest vendor prefix to surface the family name.
  if (m.toLowerCase().startsWith("claude-")) return m;
  // Custom / obscure: take the last 2 segments (e.g. "MiniMax-M3" → "M3").
  const segs = m.split("-");
  if (segs.length >= 2) return segs.slice(-2).join("-");
  return m;
}

/** "/Users/me/code/claude-manager" → "claude-manager"; Windows-aware. */
function shortPath(p: string | null): string {
  if (!p) return "(unknown)";
  // Strip drive letter on Windows
  const trimmed = p.replace(/^[A-Z]:[/\\]/, "");
  const segs = trimmed.split(/[/\\]/).filter(Boolean);
  if (segs.length === 0) return trimmed || "(unknown)";
  return segs[segs.length - 1] ?? p;
}
