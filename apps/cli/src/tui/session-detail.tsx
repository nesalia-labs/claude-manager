/**
 * Session detail panel — shown when a session is selected.
 * Renders metadata, subagents, and tool log side-by-side (or stacked
 * vertically on narrow terminals).
 */

import type { Instance } from "@claude-manager/core";

import { SubagentPanel } from "./subagent-panel.js";
import { ToolLogPanel } from "./tool-log.js";

interface SessionDetailProps {
  instance: Instance | null;
}

export function SessionDetail({ instance }: SessionDetailProps): React.ReactNode {
  if (!instance) {
    return (
      <box flexDirection="column" width="100%" flexGrow={1} paddingLeft={1} paddingRight={1}>
        <text fg="#565f89">
          {"  (select a session to see subagents + tool log)"}
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1} paddingLeft={1} paddingRight={1}>
      {/* Metadata header */}
      <box flexDirection="row" width="100%">
        <text fg="#bb9af7">{"▸ "}</text>
        <text fg="#c0caf5">
          {instance.sessionName ?? `(pid ${instance.pid})`}
        </text>
        <text fg="#565f89">{`  ·  ${instance.project ?? "?"}`}</text>
      </box>
      <box flexDirection="row" width="100%" paddingLeft={2}>
        <text fg="#7aa2f7">{`model=${instance.model ?? "?"}  `}</text>
        <text fg="#bb9af7">{`status=${instance.status}`}</text>
      </box>
      {instance.prompt ? (
        <box flexDirection="row" width="100%" paddingLeft={2}>
          <text fg="#565f89">{"prompt: "}</text>
          <text fg="#a9b1d6">{truncate(instance.prompt, 120)}</text>
        </box>
      ) : null}
      {/* Drill-down panes */}
      <box flexDirection="column" width="100%" paddingTop={1}>
        <SubagentPanel subagents={instance.subagents} />
      </box>
      <box flexDirection="column" width="100%" paddingTop={1}>
        <ToolLogPanel entries={instance.toolLog} />
      </box>
    </box>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}