/**
 * Collapsible Thinking panel.
 *
 * Controlled by the parent: `expanded` and `onToggle` come from App's
 * top-level state so the `t` keyboard shortcut and the click handler
 * stay in sync.
 *
 * When collapsed: shows the first line of the most recent thinking
 * block + a count badge. When expanded: shows the full thinking text.
 */

interface ThinkingPanelProps {
  lastThinking: string | null;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}

export function ThinkingPanel({
  lastThinking,
  count,
  expanded,
  onToggle,
}: ThinkingPanelProps): React.ReactNode {
  if (lastThinking === null || count === 0) {
    return (
      <box flexDirection="column" width="100%">
        <text fg="#bb9af7">{"  Thinking"}</text>
        <text fg="#565f89">{"    (none yet)"}</text>
      </box>
    );
  }

  const label = count === 1 ? "1 block" : `${count} blocks`;
  const preview = firstLine(lastThinking);
  const previewShort =
    preview.length > 60 ? preview.slice(0, 59) + "…" : preview;

  return (
    <box flexDirection="column" width="100%">
      <box
        flexDirection="row"
        width="100%"
        onMouseDown={onToggle}
      >
        <text fg="#7dcfff">{expanded ? "▾ " : "▸ "}</text>
        <text fg="#bb9af7">{"Thinking "}</text>
        <text fg="#565f89">{`(${label})  `}</text>
        {!expanded ? (
          <text fg="#565f89">{previewShort}</text>
        ) : (
          <text fg="#565f89">{"— press t or click to collapse"}</text>
        )}
      </box>
      {expanded ? (
        <box paddingLeft={2} paddingTop={0} paddingRight={1}>
          <text fg="#a9b1d6">{lastThinking}</text>
        </box>
      ) : null}
    </box>
  );
}