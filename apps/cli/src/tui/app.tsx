/**
 * Top-level React tree for the OpenTUI TUI. Subscribes to a `Collector`,
 * filters by view + substring, and renders the live project-grouped list
 * + a session-detail panel (subagents + tool log) on the right.
 *
 * Keyboard map (v0.4):
 *   q / Ctrl+C  → quit
 *   j / Down     → move selection down
 *   k / Up       → move selection up
 *   /           → focus the filter input
 *   Esc         → clear filter and blur input
 *   Enter       → (in filter) confirm and blur
 *   r           → force refresh
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";

import {
  type Collector,
  type Instance,
  type Snapshot,
  VERSION,
} from "@claude-manager/core";

import { FilterInput } from "./filter-input.js";
import { HeaderBar } from "./header-bar.js";
import { ProjectList } from "./project-list.js";
import { SessionDetail } from "./session-detail.js";
import { StatusBar } from "./status-bar.js";
import {
  ViewTabs,
  filterByView,
  countByView,
  type ViewFilter,
} from "./view-tabs.js";

interface AppProps {
  collector: Collector;
  onQuit: () => void;
}

export function App({ collector, onQuit }: AppProps): React.ReactNode {
  const [snapshot, setSnapshot] = useState<Snapshot>(collector.snapshot());
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [view, setView] = useState<ViewFilter>("all");
  const [filter, setFilter] = useState("");
  const [filterFocused, setFilterFocused] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = collector.subscribe((event) => {
      if (event.kind === "warning") {
        setWarning(event.message);
        return;
      }
      if (event.kind === "error") {
        setWarning(`error: ${event.error.message}`);
        return;
      }
      setSnapshot(collector.snapshot());
    });
    return () => {
      unsubscribe();
    };
  }, [collector]);

  // Apply view filter + substring filter.
  const visible = useMemo(() => {
    let xs = filterByView(snapshot.instances, view);
    if (filter.trim()) {
      const needle = filter.toLowerCase();
      xs = xs.filter((i) =>
        [i.project, i.branch, i.model, i.sessionId, i.sessionName]
          .filter((s): s is string => Boolean(s))
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    return xs;
  }, [snapshot.instances, view, filter]);
  // Force re-evaluation when filter string changes (useMemo dep already covers it).

  const counts = useMemo(() => countByView(snapshot.instances), [snapshot.instances]);

  const grouped = useMemo(() => groupByProject(visible), [visible]);
  const flatRows = useMemo(() => buildFlatRows(grouped), [grouped]);

  const pidToFlatIndex = useMemo(() => {
    const m = new Map<number, number>();
    flatRows.forEach((r, i) => {
      if (r.kind === "session") m.set(r.instance.pid, i);
    });
    return m;
  }, [flatRows]);

  const [cursor, setCursor] = useState(0);

  // Derive a safe cursor every render instead of clamping via useEffect.
  // The setter-in-render pattern fires an extra render and can lag a frame
  // behind `flatRows`.
  const safeCursor = Math.min(cursor, Math.max(0, flatRows.length - 1));

  // If the selected session disappeared from the filtered view, drop it.
  useEffect(() => {
    if (selectedPid === null) return;
    if (!visible.some((i) => i.pid === selectedPid)) setSelectedPid(null);
  }, [visible, selectedPid]);

  useKeyboard((e) => {
    // Filter input has focus — only handle Escape and Enter there.
    if (filterFocused) {
      if (e.name === "escape") {
        setFilter("");
        setFilterFocused(false);
        return;
      }
      if (e.name === "return" || e.name === "enter") {
        setFilterFocused(false);
        return;
      }
      // Otherwise let the input eat the keystroke.
      return;
    }

    if (e.name === "q" || (e.ctrl && e.name === "c")) {
      onQuit();
      return;
    }
    if (e.name === "down" || e.name === "j") {
      setCursor((c) => Math.min(c + 1, flatRows.length - 1));
      return;
    }
    if (e.name === "up" || e.name === "k") {
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.name === "r") {
      void collector.refresh();
      setWarning("refreshed");
      return;
    }
    if (e.name === "/") {
      setFilterFocused(true);
      return;
    }
    if (e.name === "t") {
      setThinkingExpanded((v) => !v);
      return;
    }
    // Number keys 1..4 switch the view tab — but only when the filter
    // input is *not* focused, so typing "1" in the filter doesn't
    // silently switch tabs.
    if (!filterFocused) {
      if (e.name === "1") return setView("all");
      if (e.name === "2") return setView("running");
      if (e.name === "3") return setView("idle");
      if (e.name === "4") return setView("done");
    }
  });

  const selectedInstance = useMemo<Instance | null>(() => {
    if (selectedPid === null) return null;
    return snapshot.instances.find((i) => i.pid === selectedPid) ?? null;
  }, [selectedPid, snapshot.instances]);

  // Stable callback so React.memo on <SessionDetail> doesn't break on every parent render.
  const handleToggleThinking = useCallback(() => {
    setThinkingExpanded((v) => !v);
  }, []);

  return (
    <box flexDirection="column" width="100%" height="100%">
      <HeaderBar
        version={VERSION}
        instanceCount={visible.length}
        totalCount={snapshot.instances.length}
        warning={warning}
        filter={
          <FilterInput
            value={filter}
            onChange={(next: string) => setFilter(next)}
            focused={filterFocused}
            onSubmit={() => setFilterFocused(false)}
            onEscape={() => {
              setFilter("");
              setFilterFocused(false);
            }}
            placeholder="press / to filter"
          />
        }
      />
      <box flexDirection="row" width="100%">
        <ViewTabs value={view} onChange={setView} counts={counts} />
      </box>
      <box flexDirection="row" width="100%" flexGrow={1}>
        <ProjectList
          grouped={grouped}
          cursor={safeCursor}
          pidToFlatIndex={pidToFlatIndex}
          onCursorChange={setCursor}
          onSelectPid={setSelectedPid}
          selectedPid={selectedPid}
          flexGrow={1}
          empty={snapshot.instances.length === 0}
        />
        {selectedInstance ? (
          <SessionDetail
            instance={selectedInstance}
            thinkingExpanded={thinkingExpanded}
            onToggleThinking={handleToggleThinking}
            flexGrow={1}
          />
        ) : null}
      </box>
      <StatusBar
        instanceCount={visible.length}
        selectedPid={selectedPid}
      />
    </box>
  );
}

// -- Helpers ------------------------------------------------------------------

type Project = {
  project: string;
  instances: Instance[];
  expanded: boolean;
};

type Row =
  | { kind: "project"; project: string; count: number }
  | { kind: "session"; instance: Instance };

function groupByProject(instances: readonly Instance[]): Project[] {
  const byProject = new Map<string, Instance[]>();
  for (const inst of instances) {
    const key = inst.project ?? "(unknown project)";
    const arr = byProject.get(key) ?? [];
    arr.push(inst);
    byProject.set(key, arr);
  }
  const out: Project[] = [];
  for (const [project, arr] of byProject) {
    arr.sort((a, b) => b.lastMs - a.lastMs);
    out.push({ project, instances: arr, expanded: true });
  }
  out.sort((a, b) => a.project.localeCompare(b.project));
  return out;
}

function buildFlatRows(grouped: Project[]): Row[] {
  const out: Row[] = [];
  for (const p of grouped) {
    out.push({ kind: "project", project: p.project, count: p.instances.length });
    if (p.expanded) {
      for (const inst of p.instances) {
        out.push({ kind: "session", instance: inst });
      }
    }
  }
  return out;
}