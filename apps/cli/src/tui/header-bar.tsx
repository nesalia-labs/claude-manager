/**
 * Header — version, instance count, optional warning line, optional filter slot.
 */

import type { ReactNode } from "react";

interface HeaderBarProps {
  version: string;
  instanceCount: number;
  /** Number of instances total (across all views), for "5 / 17" display. */
  totalCount?: number;
  warning: string | null;
  /** Slot for a filter input (rendered inline with the title row). */
  filter?: ReactNode;
}

export function HeaderBar({
  version,
  instanceCount,
  totalCount,
  warning,
  filter,
}: HeaderBarProps): React.ReactNode {
  const label = instanceCount === 1 ? "session" : "sessions";
  return (
    <box
      flexDirection="row"
      width="100%"
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg="#bb9af7">claude-manager v{version}</text>
      <text fg="#565f89">{"  ·  "}</text>
      <text fg="#7aa2f7">
        {totalCount !== undefined && totalCount !== instanceCount
          ? `${instanceCount} / ${totalCount} ${label}`
          : `${instanceCount} ${label}`}
      </text>
      <text fg="#565f89">{"  ·  "}</text>
      {filter ?? <text fg="#565f89">live</text>}
      {warning ? (
        <>
          <text fg="#565f89">{"  ·  "}</text>
          <text fg="#e0af68">⚠ {warning}</text>
        </>
      ) : null}
    </box>
  );
}