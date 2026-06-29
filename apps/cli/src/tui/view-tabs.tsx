/**
 * View tabs — All / Running / Idle / Done.
 *
 * TabSelect manages its own selected index internally. When the parent
 * changes `value`, we force a remount via `key` so the renderable picks
 * up the new default selection. (OpenTUI's TabSelectRenderableOptions
 * don't expose `selectedIndex` as a prop.)
 */

import { useMemo } from "react";
import type { Instance, SessionStatus } from "@claude-manager/core";

export type ViewFilter = "all" | SessionStatus;

interface ViewTabsProps {
  value: ViewFilter;
  onChange: (next: ViewFilter) => void;
  counts: Readonly<Record<ViewFilter, number>>;
}

const OPTIONS: ReadonlyArray<{ readonly key: ViewFilter; readonly label: string }> = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "idle", label: "Idle" },
  { key: "done", label: "Done" },
];

export function ViewTabs({ value, onChange, counts }: ViewTabsProps): React.ReactNode {
  // `selectedIndex` is computed so the React memo cache is stable across
  // renders; we use `key={value}` to force the renderable to remount with
  // the new default selection on value change.
  const selectedIndex = useMemo(
    () => OPTIONS.findIndex((o) => o.key === value),
    [value],
  );
  void selectedIndex;

  return (
    <tab-select
      key={value /* force remount on value change */}
      focused={false}
      showUnderline
      showDescription={false}
      options={OPTIONS.map((o) => ({
        name: `${o.label} (${counts[o.key]})`,
        description: "",
        value: o.key,
      }))}
      onChange={(index) => {
        const o = OPTIONS[index];
        if (o) onChange(o.key);
      }}
    />
  );
}

export function filterByView(
  instances: readonly Instance[],
  view: ViewFilter,
): Instance[] {
  if (view === "all") return [...instances];
  return instances.filter((i) => i.status === view);
}

export function countByView(instances: readonly Instance[]): Record<ViewFilter, number> {
  const counts: Record<ViewFilter, number> = {
    all: instances.length,
    running: 0,
    idle: 0,
    done: 0,
  };
  for (const inst of instances) counts[inst.status]++;
  return counts;
}