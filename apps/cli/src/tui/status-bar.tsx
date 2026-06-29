/**
 * Status bar — running / idle / done counts, selected session summary.
 */

interface StatusBarProps {
  instanceCount: number;
  selectedPid: number | null;
}

export function StatusBar({
  instanceCount,
  selectedPid,
}: StatusBarProps): React.ReactNode {
  return (
    <box flexDirection="row" width="100%" paddingLeft={1} paddingRight={1}>
      <text fg="#565f89">
        {selectedPid === null
          ? `${instanceCount} session(s)  ·  ↑/↓/j/k nav  ·  r refresh  ·  q quit`
          : `selected: pid ${selectedPid}  ·  ↑/↓/j/k nav  ·  q quit`}
      </text>
    </box>
  );
}
