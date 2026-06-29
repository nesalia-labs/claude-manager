/**
 * Project-grouped session list with selection.
 *
 * Wrapped in `<scrollbox>` so the list scrolls when it exceeds the
 * terminal height. `width="50%"` carves the panel in two with
 * `<SessionDetail>`; `stickyScroll` keeps new entries visible at the
 * bottom for live-tail behaviour.
 */

import type { Instance } from "@claude-manager/core";

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
}

const STATUS_COLORS: Record<Instance["status"], string> = {
  running: "#9ece6a",
  idle: "#e0af68",
  done: "#565f89",
};

const STATUS_GLYPHS: Record<Instance["status"], string> = {
  running: "●",
  idle: "○",
  done: "·",
};

export function ProjectList({
  grouped,
  cursor,
  pidToFlatIndex,
  selectedPid,
  onCursorChange,
  onSelectPid,
}: ProjectListProps): React.ReactNode {
  return (
    <scrollbox
      focused
      stickyScroll
      width="50%"
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
                    <text fg="#565f89">{fmtAgo(nowMs() - inst.lastMs)}</text>
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

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
// truncate is no longer used by the row layout; keep available for
// future detail-pane use.
void truncate;

/** "MiniMax-M3" → "M-M3", "claude-sonnet-4-5-20260101" → "sonnet-4-5". */
function shortModel(model: string | null): string {
  if (!model) return "?";
  // Drop trailing date stamps (8-digit suffix).
  let m = model.replace(/-\d{8}$/, "");
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

/** "12345" → "12k", "1234567" → "1.2M", null → "?" */
function fmtContext(n: number | null): string {
  if (n === null) return "?ctx";
  if (n < 1000) return `${n}ctx`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}kctx`;
  return `${(n / 1_000_000).toFixed(1)}Mctx`;
}

/** "1500ms" → "1s", "120000ms" → "2m", "3600000ms" → "1h. */
function fmtAgo(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Live clock for "ago" computation. */
const nowMs = (): number => Date.now();