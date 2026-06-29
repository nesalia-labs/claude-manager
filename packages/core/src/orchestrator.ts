/**
 * Internal orchestrator — runs one scan, emits rows. Combines the
 * registry + transcript + subagents + process sources into `Instance[]`.
 *
 * Performance notes (see `feedback_idempotent_tui_shutdown` memory and
 * the perf investigation report):
 *  - Per-session work is parallelised across sessions with `Promise.all`.
 *  - Subagent directories are claimed sequentially via `claimedDirs`
 *    (mirrors cctop's `attachSubagentsInOrder`) so two sessions sharing
 *    a transcript can't both try to enumerate the same `<id>/subagents/`.
 *  - Each session's transcript is read **once**; the cached `Details`
 *    feeds both `lastMs` and the row's `branch`/`model`/`contextTokens`.
 */

import { dirname } from "node:path";

import { deriveStatus } from "./domain/status.js";
import type { Session } from "./domain/session.js";
import { detailsAreComplete } from "./domain/transcript.js";
import type { ClockSource } from "./sources/clock.js";
import type { ProcSource } from "./sources/proc/types.js";
import type { SessionsSource } from "./sources/sessions.js";
import type { SubagentSource } from "./sources/subagents.js";
import type { TranscriptSource } from "./sources/transcript.js";
import type { ToolLogSource } from "./sources/tool-log.js";
import type {
  CollectorEvent,
  Instance,
  Snapshot,
  StatusThresholds,
  SubAgent,
  ToolLogEntry,
} from "./types.js";

export interface OrchestratorSources {
  readonly clock: ClockSource;
  readonly sessions: SessionsSource;
  readonly transcripts: TranscriptSource;
  readonly proc: ProcSource;
  readonly subagents: SubagentSource;
  readonly toolLog: ToolLogSource;
}

export interface OrchestratorOptions {
  readonly watchMs: number;
  readonly thresholds: StatusThresholds;
}

interface BuildRowInput {
  session: Session;
  transcriptResult: Awaited<ReturnType<TranscriptSource["read"]>> | null;
  transcriptPath: string | null;
  transcriptMtime: number;
  subagents: readonly SubAgent[];
  toolLog: readonly ToolLogEntry[];
  processAlive: boolean;
  nowMs: number;
  thresholds: StatusThresholds;
}

function buildRow(input: BuildRowInput): Instance {
  const { session, transcriptResult, transcriptPath, subagents, toolLog, processAlive, nowMs, thresholds, transcriptMtime } = input;
  const lastMs = Math.max(session.updatedAt ?? 0, transcriptMtime);
  const status = deriveStatus({
    processAlive,
    lastMs,
    nowMs,
    thresholds,
  });

  let branch: string | null = null;
  let model: string | null = null;
  let contextTokens: number | null = null;
  let prompt: string | null = null;
  let lastMessage: string | null = null;
  let lastThinking: string | null = null;
  let thinkingCount = 0;
  if (transcriptResult && detailsAreComplete(transcriptResult.details)) {
    branch = transcriptResult.details.branch ?? null;
    model = transcriptResult.details.model ?? null;
    contextTokens = transcriptResult.details.ctx ?? null;
    prompt = transcriptResult.details.prompt ?? null;
    lastMessage = transcriptResult.details.lastMessage ?? null;
    lastThinking = transcriptResult.details.lastThinking ?? null;
    thinkingCount = transcriptResult.details.thinkingCount ?? 0;
  }

  return {
    pid: session.pid,
    sessionId: session.sessionId,
    sessionName: session.name ?? null,
    project: session.cwd,
    projectEncoded: null,
    branch,
    model,
    contextTokens,
    status,
    uptimeSec: session.startedAt
      ? Math.max(0, Math.floor(nowMs / 1000 - session.startedAt / 1000))
      : 0,
    lastMs,
    prompt,
    lastMessage,
    lastThinking,
    thinkingCount,
    processAlive,
    transcript: transcriptPath,
    subagents,
    children: [],
    orphanPorts: [],
    toolLog,
  };
}

/**
 * Run one collection cycle. Returns the snapshot and the events that
 * represent the difference between this snapshot and the previous one.
 */
export async function collectOnce(
  sources: OrchestratorSources,
  options: OrchestratorOptions,
): Promise<Snapshot> {
  const nowMs = sources.clock.now();
  const events: CollectorEvent[] = [];

  // 1) Read the registry.
  const sessionsMap = await sources.sessions.read().catch((err) => {
    events.push({
      kind: "warning",
      source: "registry",
      message: `failed to read sessions: ${(err as Error).message}`,
      atMs: nowMs,
    });
    return new Map();
  });

  // 2) Read the process table once. The proc source caches internally
  // for a short TTL so this is cheap to call every tick.
  const procs = await sources.proc.list().catch((err) => {
    events.push({
      kind: "warning",
      source: "proc",
      message: `failed to list processes: ${(err as Error).message}`,
      atMs: nowMs,
    });
    return [];
  });
  const procByPid = new Map(procs.map((p) => [p.pid, p]));

  // 3) Build a row per session, in parallel.
  const liveTranscripts = new Set<string>();
  // Sequential claim across collectors for the same transcript's
  // `subagents/` directory.
  const claimedSubagentDirs = new Set<string>();

  const rows = await Promise.all(
    [...sessionsMap.values()].map(async (session): Promise<Instance> => {
      const proc = procByPid.get(session.pid);
      const processAlive = proc !== undefined;

      // Discover + read the transcript ONCE.
      let transcriptPath: string | null = null;
      let transcriptMtime = 0;
      let transcriptResult: Awaited<
        ReturnType<TranscriptSource["read"]>
      > | null = null;
      const discovered = await sources.transcripts
        .discover(session.cwd, Math.floor((session.startedAt ?? nowMs) / 1000))
        .catch(() => null);
      if (discovered) {
        const r = await sources.transcripts.read(discovered).catch((err) => {
          events.push({
            kind: "warning",
            source: "transcript",
            message: `failed to read transcript: ${(err as Error).message}`,
            atMs: nowMs,
          });
          return null;
        });
        if (r) {
          transcriptPath = discovered;
          transcriptMtime = r.mtimeMs;
          transcriptResult = r;
          liveTranscripts.add(discovered);
        }
      }

      // Subagents + tool log — independent reads, run in parallel with
      // each other but sequential against the transcript read above.
      const [subagents, toolLog] = await Promise.all([
        transcriptPath
          ? sources.subagents
              .listLive(
                dirname(transcriptPath),
                session.sessionId,
                nowMs,
                claimedSubagentDirs,
              )
              .catch(() => [])
          : Promise.resolve([]),
        transcriptPath
          ? sources.toolLog.read(transcriptPath, transcriptMtime).catch(() => [])
          : Promise.resolve([]),
      ]);

      return buildRow({
        session,
        transcriptResult,
        transcriptPath,
        transcriptMtime,
        subagents,
        toolLog,
        processAlive,
        nowMs,
        thresholds: options.thresholds,
      });
    }),
  );

  sources.transcripts.prune(liveTranscripts);
  void events;

  return {
    atMs: nowMs,
    instances: rows,
  };
}