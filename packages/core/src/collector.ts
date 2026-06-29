/**
 * `createCollector` — the live, polling surface. One instance owns its
 * own caches, timers, and event-stream subscriptions.
 */

import { createSystemClockSource } from "./sources/clock.js";
import { createProcSource } from "./sources/proc/index.js";
import { createNodeEnvSource } from "./sources/env.js";
import { createNodeSessionsSource } from "./sources/sessions.js";
import { createNodeSubagentSource } from "./sources/subagents.js";
import { createNodeToolLogSource } from "./sources/tool-log.js";
import { createNodeTranscriptSource } from "./sources/transcript.js";

import { collectOnce, type OrchestratorSources } from "./orchestrator.js";

import { DEFAULT_STATUS_THRESHOLDS } from "./types.js";

import type {
  Collector,
  CollectorEvent,
  CollectorOptions,
  Snapshot,
  Unsubscribe,
} from "./types.js";
import { SnapshotStore } from "./snapshot.js";

const DEFAULT_WATCH_MS = 1000;

export function createCollector(opts: CollectorOptions = {}): Collector {
  // claudeDir is resolved once at construction: explicit override wins,
  // otherwise honour $CLAUDE_CONFIG_DIR (with ~ expansion) like once.ts.
  const claudeDir =
    opts.claudeDir ?? createNodeEnvSource().getClaudeDir();

  const watchMs = opts.watchMs ?? DEFAULT_WATCH_MS;
  const thresholds = opts.statusThresholds ?? DEFAULT_STATUS_THRESHOLDS;

  const sources: OrchestratorSources = {
    clock: createSystemClockSource(),
    sessions: createNodeSessionsSource(claudeDir),
    transcripts: createNodeTranscriptSource(claudeDir),
    subagents: createNodeSubagentSource(),
    toolLog: createNodeToolLogSource(),
    proc: createProcSource(),
  };

  const store = new SnapshotStore();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let inflight: Promise<void> | null = null;

  async function tick(): Promise<void> {
    try {
      const snap = await collectOnce(sources, { watchMs, thresholds });
      const events = store.setAll(snap.instances, snap.atMs);
      for (const ev of events) store.emit(ev);
    } catch (err) {
      store.emit({
        kind: "error",
        error: err instanceof Error ? err : new Error(String(err)),
        atMs: sources.clock.now(),
      });
    }
  }

  function start(): void {
    if (timer || closed) return;
    inflight = tick().finally(() => {
      inflight = null;
    });
    timer = setInterval(() => {
      if (closed) return;
      if (inflight) return;
      inflight = tick().finally(() => {
        inflight = null;
      });
    }, watchMs);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    snapshot(): Snapshot {
      return store.read(sources.clock.now());
    },
    subscribe(listener: (event: CollectorEvent) => void): Unsubscribe {
      const off = store.subscribe(listener);
      if (!timer && !closed) start();
      return off;
    },
    async refresh(): Promise<Snapshot> {
      if (closed) throw new Error("collector is closed");
      if (inflight) await inflight;
      inflight = tick().finally(() => {
        inflight = null;
      });
      await inflight;
      return store.read(sources.clock.now());
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      stop();
      if (inflight) await inflight.catch(() => undefined);
      await sources.proc.close().catch(() => undefined);
    },
  };
}
