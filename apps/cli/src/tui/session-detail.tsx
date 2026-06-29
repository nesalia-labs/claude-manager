/**
 * Session detail panel — full metadata + subagents + tool log.
 * Rendered on the right when a session is selected.
 */

import type { Instance } from "@claude-manager/core";

import { SubagentPanel } from "./subagent-panel.js";
import { ToolLogPanel } from "./tool-log.js";

interface SessionDetailProps {
  instance: Instance | null;
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

function fmtContext(n: number | null): string {
  if (n === null) return "—";
  if (n < 1000) return `${n} tokens`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k tokens`;
  return `${(n / 1_000_000).toFixed(1)}M tokens`;
}

function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

function fmtAgo(ms: number, now: number): string {
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

export function SessionDetail({ instance }: SessionDetailProps): React.ReactNode {
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
      flexGrow={1}
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
        <KV label="project" value={instance.project} />
        <KV label="branch"  value={instance.branch} />
        <KV label="model"   value={instance.model} />
        <KV label="tokens"  value={fmtContext(instance.contextTokens)} accent />
        <KV label="uptime"  value={fmtUptime(instance.uptimeSec)} />
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

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}