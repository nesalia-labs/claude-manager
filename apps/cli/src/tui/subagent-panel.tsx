/**
 * Subagent panel — live sub-agents spawned by the focused session.
 * Rendered as a compact list, sorted by context size (biggest consumers
 * at the top), color-coded by activity.
 */

import type { SubAgent } from "@claude-manager/core";

interface SubagentPanelProps {
  subagents: readonly SubAgent[];
  /**
   * Max height (in rows) for the inner scrollbox. When `undefined`, the
   * list renders inline with no internal scroll. Pass a value to keep a
   * long list of live sub-agents from pushing sibling content off-screen.
   */
  maxHeight?: number;
}

const STATUS_GLYPHS = {
  // We don't currently propagate live-ness through `Instance.subagents`,
  // so we render a uniform glyph; the activity line carries the latest
  // tool_use label. Future v0.2 work: emit a `running` field on
  // `SubAgent` for a richer display.
  live: "◆",
} as const;

export function SubagentPanel({
  subagents,
  maxHeight,
}: SubagentPanelProps): React.ReactNode {
  if (subagents.length === 0) {
    return (
      <box flexDirection="column" width="100%">
        <text fg="#565f89">{"  (no live subagents)"}</text>
      </box>
    );
  }
  const rows = (
    <>
      <text fg="#bb9af7">
        {`  Subagents (${subagents.length})`}
      </text>
      {subagents.map((sa, idx) => (
        <box
          // `id` is stable across re-sorts; fall back to a composite of the
          // visible fields if a literal was constructed without an id (e.g.
          // in tests). The index alone would remount rows on every reorder.
          key={sa.id ?? `${sa.model ?? "?"}-${sa.activity ?? ""}-${sa.uptimeSec}-${idx}`}
          flexDirection="row"
          width="100%"
          paddingLeft={4}
        >
          <text fg="#9ece6a">{`${STATUS_GLYPHS.live} `}</text>
          <text fg="#7aa2f7">{(sa.model ?? "?").padEnd(22)}</text>
          <text fg="#bb9af7">{` ctx=${fmtContext(sa.ctx).padStart(5)} `}</text>
          <text fg="#c0caf5">{sa.activity ?? "(idle)"}</text>
          <text fg="#565f89">{`  ${sa.uptimeSec}s`}</text>
        </box>
      ))}
    </>
  );
  if (maxHeight !== undefined) {
    return (
      <scrollbox
        width="100%"
        height={maxHeight}
        scrollY
        scrollbarOptions={{ showArrows: false }}
        flexDirection="column"
      >
        {rows}
      </scrollbox>
    );
  }
  return <box flexDirection="column" width="100%">{rows}</box>;
}

/** "12345" → "12k", null → "?". Local to this panel — different scale
 * than the session-level token formatter. */
function fmtContext(n: number | null): string {
  if (n === null) return "?";
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
