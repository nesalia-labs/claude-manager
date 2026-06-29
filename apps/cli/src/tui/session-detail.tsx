/**
 * Session detail panel — full metadata + subagents + tool log + thinking.
 * Rendered on the right when a session is selected.
 *
 * The Thinking block is collapsible. `expanded` is controlled by the
 * parent (App) so the `t` keyboard shortcut and the click handler stay
 * in sync.
 */

import { memo } from "react";
import type { Instance } from "@claude-manager/core";

import { SubagentPanel } from "./subagent-panel.js";
import { ThinkingPanel } from "./thinking-panel.js";
import { ToolLogPanel } from "./tool-log.js";
import {
  STATUS_COLORS,
  STATUS_GLYPHS,
  fmtAgo,
  fmtContext,
  truncate,
} from "./format.js";

interface SessionDetailProps {
  instance: Instance | null;
  thinkingExpanded: boolean;
  onToggleThinking: () => void;
  /** Flex grow ratio. Defaults to 1; layout must remain stable across renders. */
  flexGrow?: number;
}

function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function SessionDetailImpl({
  instance,
  thinkingExpanded,
  onToggleThinking,
  flexGrow,
}: SessionDetailProps): React.ReactNode {
  if (!instance) return null;

  const statusColor = STATUS_COLORS[instance.status];
  const statusGlyph = STATUS_GLYPHS[instance.status];
  const now = Date.now();
  const subagentCount = instance.subagents.length;
  const toolCount = instance.toolLog.length;

  return (
    <box
      flexDirection="column"
      width="50%"
      flexGrow={flexGrow ?? 1}
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Header row: name + status */}
      <box flexDirection="row" width="100%">
        <text fg={statusColor}>{statusGlyph} </text>
        <text fg="#c0caf5">
          {instance.sessionName ?? `pid ${instance.pid}`}
        </text>
      </box>

      {/* Metadata block */}
      <box flexDirection="column" width="100%" paddingLeft={2}>
        <KV label="project"  value={instance.project} />
        <KV label="branch"   value={instance.branch} />
        <KV label="model"    value={instance.model} />
        <KV label="tokens"   value={fmtContext(instance.contextTokens)} accent />
        <KV label="uptime"   value={fmtUptime(instance.uptimeSec)} />
        <KV label="last"     value={fmtAgo(instance.lastMs, now)} />
        <KV label="subagents" value={`${subagentCount}`} />
        <KV label="tools"     value={`${toolCount}`} />
      </box>

      {/* Last assistant message */}
      <box flexDirection="column" width="100%" paddingTop={1}>
        <text fg="#bb9af7">{"  Last message"}</text>
        <box paddingLeft={2} paddingTop={0} paddingRight={1}>
          {instance.lastMessage ? (
            <text fg="#c0caf5">{instance.lastMessage}</text>
          ) : (
            <text fg="#565f89">{"(no assistant message yet)"}</text>
          )}
        </box>
      </box>

      {/* Thinking — collapsible via click or `t` */}
      <box flexDirection="column" width="100%" paddingTop={1}>
        <ThinkingPanel
          lastThinking={instance.lastThinking}
          count={instance.thinkingCount}
          expanded={thinkingExpanded}
          onToggle={onToggleThinking}
        />
      </box>

      {/* First user prompt (for context) */}
      {instance.prompt ? (
        <box flexDirection="column" width="100%" paddingTop={1}>
          <text fg="#bb9af7">{"  First prompt"}</text>
          <box paddingLeft={2} paddingRight={1}>
            <text fg="#a9b1d6">{truncate(instance.prompt, 240)}</text>
          </box>
        </box>
      ) : null}

      {/* Subagents */}
      <box flexDirection="column" width="100%" paddingTop={1}>
        <SubagentPanel subagents={instance.subagents} />
      </box>

      {/* Tool log */}
      <box flexDirection="column" width="100%" paddingTop={1}>
        <ToolLogPanel entries={instance.toolLog} />
      </box>
    </box>
  );
}

interface KVProps {
  label: string;
  value: string | null;
  accent?: boolean;
}

function KV({ label, value, accent }: KVProps): React.ReactNode {
  if (value === null || value === undefined) return null;
  return (
    <box flexDirection="row">
      <text fg="#565f89">{`${label.padEnd(10)} `}</text>
      <text fg={accent ? "#bb9af7" : "#c0caf5"}>{value}</text>
    </box>
  );
}

/**
 * Memoized so unrelated state changes upstream (e.g. snapshot ticks that
 * don't change the visible session) don't re-render the detail panel.
 * The parent (`App`) passes a stable `onToggleThinking` via `useCallback`
 * so the memo boundary actually holds.
 */
export const SessionDetail = memo(SessionDetailImpl);
