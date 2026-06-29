/**
 * End-to-end integration test for `createCollector`. We wire a real
 * `SnapshotStore` + orchestrator to in-memory stub sources (no node:fs,
 * no node:child_process) and exercise the public `Collector` surface:
 *
 *   - first refresh populates the snapshot
 *   - subscribe() delivers events on each tick
 *   - cache hit when source mtime hasn't advanced
 *   - polling timer fires at watchMs interval (vi.useFakeTimers)
 *   - close() releases everything (idempotent)
 */

import { Volume, createFsFromVolume } from "memfs";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  collectOnce,
  type OrchestratorSources,
} from "../../src/orchestrator.js";

import { type ClockSource } from "../../src/sources/clock.js";
import type { ProcSource } from "../../src/sources/proc/types.js";
import type { Session } from "../../src/domain/session.js";
import type { Details } from "../../src/domain/transcript.js";
import type { SessionsSource } from "../../src/sources/sessions.js";
import type { SubagentSource } from "../../src/sources/subagents.js";
import type { ToolLogSource } from "../../src/sources/tool-log.js";
import type { TranscriptSource } from "../../src/sources/transcript.js";
import { SnapshotStore } from "../../src/snapshot.js";
import {
  DEFAULT_STATUS_THRESHOLDS,
  type CollectorEvent,
  type SubAgent,
  type ToolLogEntry,
} from "../../src/types.js";

import { createCollector } from "../../src/collector.js";

/* ----------------------- stubs (no node:fs, no node:child_process) ----------------------- */

const PID = 4242;

/** A "complete" Details shape — `detailsAreComplete` requires model + prompt + branch. */
function makeDetails(): Details {
  return {
    model: "claude-test-model",
    ctx: 1234,
    branch: "main",
    prompt: "stub prompt",
  };
}

interface StubState {
  sessions: Map<number, Session>;
  transcriptMtime: Map<string, number>;
  transcriptDetails: Map<string, Details>;
  subagents: SubAgent[];
  toolLog: Map<string, ToolLogEntry[]>;
  procList: Set<number>;
  nowMs: number;
}

function makeSession(over: Partial<Session> = {}): Session {
  return {
    pid: PID,
    sessionId: "sess-stub-1",
    cwd: "/tmp/stub-project",
    startedAt: 1_700_000_000,
    name: "stub-session",
    ...over,
  };
}

function buildState(nowMs = 1_700_000_005_000): StubState {
  return {
    sessions: new Map(),
    transcriptMtime: new Map(),
    transcriptDetails: new Map(),
    subagents: [],
    toolLog: new Map(),
    procList: new Set([PID]),
    nowMs,
  };
}

function makeSources(state: StubState): OrchestratorSources {
  const clock: ClockSource = { now: () => state.nowMs };
  const sessions: SessionsSource = {
    async read() {
      return new Map([...state.sessions.entries()]);
    },
  };
  const transcripts: TranscriptSource = {
    async read(path) {
      return {
        mtimeMs: state.transcriptMtime.get(path) ?? 0,
        details: state.transcriptDetails.get(path) ?? {},
      };
    },
    async discover(cwd) {
      for (const path of state.transcriptMtime.keys()) {
        if (path.startsWith(cwd)) return path;
      }
      return null;
    },
    prune() {},
  };
  const subagents: SubagentSource = {
    async listLive() {
      return state.subagents;
    },
  };
  const toolLog: ToolLogSource = {
    async read(path) {
      return state.toolLog.get(path) ?? [];
    },
  };
  const proc: ProcSource = {
    async list() {
      return [...state.procList].map((pid) => ({
        pid,
        ppid: 0,
        rss: 0,
        cpuSec: 0,
        startSec: 0,
        path: null,
        name: "stub",
        uid: 0,
      }));
    },
    async cwdOf() {
      return null;
    },
    async close() {},
  };
  return { clock, sessions, transcripts, subagents, toolLog, proc };
}

/* ----------------------------- tests ----------------------------------------- */

describe("integration — orchestrator + SnapshotStore", () => {
  let _vol: ReturnType<typeof Volume.fromJSON>;
  let _fs: ReturnType<typeof createFsFromVolume>;

  beforeEach(() => {
    _vol = Volume.fromJSON({}, "/");
    _fs = createFsFromVolume(_vol);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first refresh populates the snapshot via collectOnce", async () => {
    const state = buildState();
    state.sessions.set(PID, makeSession());
    state.transcriptMtime.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      1_700_000_003_000,
    );
    state.transcriptDetails.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      makeDetails(),
    );

    const sources = makeSources(state);
    const result = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });

    expect(result.instances).toHaveLength(1);
    const row = result.instances[0]!;
    expect(row.pid).toBe(PID);
    expect(row.processAlive).toBe(true);
    expect(row.model).toBe("claude-test-model");
    expect(row.contextTokens).toBe(1234);
    expect(row.branch).toBe("main");
  });

  it("subscribe() receives add/update/remove events across ticks", async () => {
    const state = buildState();
    const sources = makeSources(state);
    const store = new SnapshotStore();
    const seen: CollectorEvent[] = [];
    const unsubscribe = store.subscribe((ev) => seen.push(ev));

    const driveTick = async () => {
      const result = await collectOnce(sources, {
        watchMs: 60_000,
        thresholds: DEFAULT_STATUS_THRESHOLDS,
      });
      const diff = store.setAll(result.instances, result.atMs);
      for (const ev of diff) store.emit(ev);
      for (const ev of result.events) store.emit(ev);
    };

    // Tick 1: no sessions → no events.
    await driveTick();
    expect(seen).toEqual([]);

    // Tick 2: one session appears with a complete transcript.
    state.sessions.set(PID, makeSession());
    state.transcriptMtime.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      1_700_000_003_000,
    );
    state.transcriptDetails.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      makeDetails(),
    );
    state.nowMs += 1000;
    await driveTick();
    expect(seen.some((e) => e.kind === "add")).toBe(true);

    // Tick 3: transcript mtime advances → update.
    state.transcriptMtime.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      1_700_000_006_000,
    );
    state.nowMs += 1000;
    await driveTick();
    expect(seen.some((e) => e.kind === "update")).toBe(true);

    // Tick 4: session removed → remove.
    state.sessions.clear();
    state.nowMs += 1000;
    await driveTick();
    expect(seen.some((e) => e.kind === "remove")).toBe(true);

    unsubscribe();
  });

  it("orchestrator returns identical detail fields on a second tick (mtime unchanged)", async () => {
    const state = buildState();
    state.sessions.set(PID, makeSession());
    state.transcriptMtime.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      1_700_000_003_000,
    );
    state.transcriptDetails.set(
      "/tmp/stub-project/sess-stub-1.jsonl",
      makeDetails(),
    );
    const sources = makeSources(state);

    const r1 = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });
    state.nowMs += 100;
    const r2 = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });

    // Same model/ctx/branch on the second call.
    expect(r2.instances[0]!.model).toBe(r1.instances[0]!.model);
    expect(r2.instances[0]!.contextTokens).toBe(r1.instances[0]!.contextTokens);
    expect(r2.instances[0]!.branch).toBe(r1.instances[0]!.branch);
    // Snapshot atMs should advance because the clock advanced.
    expect(r2.atMs).toBeGreaterThan(r1.atMs);
  });

  it("createCollector installs a polling timer at watchMs interval", async () => {
    // Use real timers — mock the global setInterval + clearInterval via vi
    // spy so we can assert how often the collector re-ticks.
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const collector = createCollector({
      claudeDir: "/dev/null",
      watchMs: 100,
    });

    // wait for any in-flight eager tick to drain
    await collector.refresh();

    // createCollector must have installed an interval at our watchMs.
    expect(setIntervalSpy).toHaveBeenCalled();
    const firstCall = setIntervalSpy.mock.calls.find(
      (args) => typeof args[1] === "number" && args[1] === 100,
    );
    expect(firstCall).toBeDefined();

    // Verify the interval handle was cleared on close.
    await collector.close();
    expect(clearIntervalSpy).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("close() is idempotent and does not throw on second close", async () => {
    vi.useFakeTimers();
    const collector = createCollector({
      claudeDir: "/dev/null",
      watchMs: 60_000,
    });
    await collector.refresh();
    await collector.close();
    // Second close should be a no-op.
    await collector.close();
  });
});
