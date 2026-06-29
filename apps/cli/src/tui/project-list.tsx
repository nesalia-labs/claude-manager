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
                      {`pid ${String(inst.pid).padEnd(6)}`}
                    </text>
                    <text fg="#565f89">{"  "}</text>
                    <text fg="#a9b1d6">
                      {inst.sessionName ??
                        (inst.prompt ? truncate(inst.prompt, 48) : "(no prompt)")}
                    </text>
                    <text fg="#565f89">{"  "}</text>
                    <text fg="#7aa2f7">{inst.model ?? "?"}</text>
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