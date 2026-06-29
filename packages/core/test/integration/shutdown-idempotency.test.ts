/**
 * Shutdown idempotency — verify that the orchestrator swallows bad
 * data (malformed JSON, missing files) instead of throwing, and that
 * the Collector can be `close()`d twice without error.
 *
 * Together these are the core's "clean teardown" guarantees: the
 * tool must never propagate a stray read error to the renderer's
 * event loop, and the polling timer + proc handles must be released
 * on shutdown even if the consumer calls close() prematurely.
 */

import { Volume, createFsFromVolume } from "memfs";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
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
import {
  DEFAULT_STATUS_THRESHOLDS,
  type SubAgent,
  type ToolLogEntry,
} from "../../src/types.js";

const PID = 4242;

function makeSession(): Session {
  return {
    pid: PID,
    sessionId: "sess-stub-1",
    cwd: "/tmp/stub-project",
    startedAt: 1_700_000_000,
    name: "stub-session",
  };
}

/** A source that returns a malformed entry from `read` (throws inside). */
function makeBrokenTranscript(): TranscriptSource {
  return {
    async read() {
      throw new SyntaxError("malformed JSONL line — unterminated object");
    },
    async discover() {
      return "/tmp/stub-project/sess-stub-1.jsonl";
    },
    prune() {},
  };
}

function makeBrokenSessions(): SessionsSource {
  return {
    async read() {
      throw new Error("EACCES: permission denied, scandir");
    },
  };
}

function makeBrokenProc(): ProcSource {
  return {
    async list() {
      throw new Error("tasklist exited with code 1");
    },
    async cwdOf() {
      return null;
    },
    async close() {},
  };
}

function makeGood(): {
  clock: ClockSource;
  sessions: SessionsSource;
  transcripts: TranscriptSource;
  subagents: SubagentSource;
  toolLog: ToolLogSource;
  proc: ProcSource;
} {
  const clock: ClockSource = { now: () => 1_700_000_005_000 };
  const sessions: SessionsSource = {
    async read() {
      return new Map([[PID, makeSession()]]);
    },
  };
  const emptyDetails: Details = {};
  const transcripts: TranscriptSource = {
    async read() {
      return { mtimeMs: 0, details: emptyDetails };
    },
    async discover() {
      return null;
    },
    prune() {},
  };
  const subagents: SubagentSource = {
    async listLive() {
      return [] as SubAgent[];
    },
  };
  const toolLog: ToolLogSource = {
    async read() {
      return [] as ToolLogEntry[];
    },
  };
  const proc: ProcSource = {
    async list() {
      return [
        {
          pid: PID,
          ppid: 0,
          rss: 0,
          cpuSec: 0,
          startSec: 0,
          path: null,
          name: "stub",
          uid: 0,
        },
      ];
    },
    async cwdOf() {
      return null;
    },
    async close() {},
  };
  return { clock, sessions, transcripts, subagents, toolLog, proc };
}

describe("integration — shutdown idempotency & error swallowing", () => {
  let _vol: ReturnType<typeof Volume.fromJSON>;
  let _fs: ReturnType<typeof createFsFromVolume>;

  beforeEach(() => {
    _vol = Volume.fromJSON({}, "/");
    _fs = createFsFromVolume(_vol);
  });

  afterEach(() => {});

  it("collectOnce does not throw when sessions.read() fails", async () => {
    const good = makeGood();
    const sources: OrchestratorSources = {
      ...good,
      sessions: makeBrokenSessions(),
    };
    // Should resolve with empty instances + a warning event — never throw.
    const result = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });
    expect(result.instances).toEqual([]);
  });

  it("collectOnce does not throw when proc.list() fails", async () => {
    const good = makeGood();
    const sources: OrchestratorSources = {
      ...good,
      proc: makeBrokenProc(),
    };
    const result = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });
    // One session but proc error → instances list reflects what we have.
    expect(result.instances.length).toBeGreaterThan(0);
  });

  it("collectOnce does not throw when transcript.read() throws (corrupt JSONL)", async () => {
    const good = makeGood();
    const sources: OrchestratorSources = {
      ...good,
      transcripts: makeBrokenTranscript(),
    };
    const result = await collectOnce(sources, {
      watchMs: 60_000,
      thresholds: DEFAULT_STATUS_THRESHOLDS,
    });
    // session row is still produced (process alive, no transcript details).
    expect(result.instances).toHaveLength(1);
    const row = result.instances[0]!;
    expect(row.pid).toBe(PID);
    expect(row.processAlive).toBe(true);
    // Transcript-related fields stay null because the read failed.
    expect(row.model).toBeNull();
    expect(row.contextTokens).toBeNull();
  });

  it("Collector.close() is idempotent — second call is a no-op", async () => {
    const { createCollector } = await import("../../src/collector.js");
    const collector = createCollector({
      claudeDir: "/dev/null",
      watchMs: 60_000,
    });
    await collector.refresh();
    await collector.close();
    await collector.close();
    // Subsequent refresh() after close must throw.
    await expect(collector.refresh()).rejects.toThrow(/closed/i);
  });
});
