/**
 * Internal: a Snapshot owns the mutable Map<number, Instance> and emits diff
 * events to subscribers on every change. The renderer never mutates this
 * directly — it always reads through `Collector.snapshot()`.
 */

import type { CollectorEvent, Instance, Snapshot } from "./types.js";

type Listener = (event: CollectorEvent) => void;

export class SnapshotStore {
  private readonly byPid = new Map<number, Instance>();
  private readonly listeners = new Set<Listener>();
  private lastAtMs = 0;

  /** Replace the snapshot wholesale (e.g., after a refresh tick). */
  setAll(instances: readonly Instance[], atMs: number): CollectorEvent[] {
    const events: CollectorEvent[] = [];
    const nextByPid = new Map<number, Instance>();
    for (const inst of instances) nextByPid.set(inst.pid, inst);

    // add / update
    for (const inst of instances) {
      const prev = this.byPid.get(inst.pid);
      if (!prev) {
        events.push({ kind: "add", instance: inst, atMs });
      } else if (instancesDiffer(prev, inst)) {
        events.push({ kind: "update", pid: inst.pid, instance: inst, atMs });
      }
    }
    // remove
    for (const pid of this.byPid.keys()) {
      if (!nextByPid.has(pid)) {
        events.push({ kind: "remove", pid, atMs });
      }
    }
    this.byPid.clear();
    for (const [pid, inst] of nextByPid) this.byPid.set(pid, inst);
    this.lastAtMs = atMs;
    return events;
  }

  /** Read the current snapshot. */
  read(atMs: number): Snapshot {
    return {
      atMs,
      instances: Array.from(this.byPid.values()),
    };
  }

  lastWriteMs(): number {
    return this.lastAtMs;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: CollectorEvent): void {
    for (const l of this.listeners) l(event);
  }
}

function instancesDiffer(a: Instance, b: Instance): boolean {
  // Cheap structural equality over the row's volatile fields. Stable
  // fields (project, sessionId, name) are part of identity; we ignore them.
  return (
    a.status !== b.status ||
    a.model !== b.model ||
    a.contextTokens !== b.contextTokens ||
    a.lastMs !== b.lastMs ||
    a.uptimeSec !== b.uptimeSec ||
    a.processAlive !== b.processAlive ||
    a.branch !== b.branch ||
    a.prompt !== b.prompt ||
    a.subagents.length !== b.subagents.length ||
    a.children.length !== b.children.length ||
    a.orphanPorts.length !== b.orphanPorts.length
  );
}
