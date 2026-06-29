/**
 * Subagent panel — live sub-agents spawned by the focused session.
 * Rendered as a compact list, sorted by context size (biggest consumers
 * at the top), color-coded by activity.
 */

import type { SubAgent } from "@claude-manager/core";

interface SubagentPanelProps {
  subagents: readonly SubAgent[];
}

const STATUS_GLYPHS = {
  // We don't currently propagate live-ness through `Instance.subagents`,
  // so we render a uniform glyph; the activity line carries the latest
  // tool_use label. Future v0.2 work: emit a `running` field on
  // `SubAgent` for a richer display.
  live: "◆",
};

function fmtContext(n: number | null): string {
  if (n === null) return "?";
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function SubagentPanel({ subagents }: SubagentPanelProps): React.ReactNode {
  if (subagents.length === 0) {
    return (
      <box flexDirection="column" width="100%">
        <text fg="#565f89">{"  (no live subagents)"}</text>
      </box>
    );
  }
  return (
    <box flexDirection="column" width="100%">
      <text fg="#bb9af7">
        {`  Subagents (${subagents.length})`}
      </text>
      {subagents.map((sa, idx) => (
        <box
          key={idx}
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
    </box>
  );
}