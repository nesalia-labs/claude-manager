/**
 * `collectOnce` — one-shot snapshot for `--once`, `--json`, scripts.
 * No state held beyond a single function call.
 */

import { createNodeEnvSource } from "./sources/env.js";
import { createProcSource } from "./sources/proc/index.js";
import { createNodeSessionsSource } from "./sources/sessions.js";
import { createNodeSubagentSource } from "./sources/subagents.js";
import { createNodeToolLogSource } from "./sources/tool-log.js";
import { createNodeTranscriptSource } from "./sources/transcript.js";
import { createSystemClockSource } from "./sources/clock.js";

import { collectOnce as orchestratorCollectOnce } from "./orchestrator.js";
import { DEFAULT_STATUS_THRESHOLDS } from "./types.js";

import type { Filter, Instance, Snapshot } from "./types.js";

export interface CollectOnceOptions {
  readonly claudeDir?: string;
}

export async function collectOnce(
  filter: Filter,
  options: CollectOnceOptions = {},
): Promise<Snapshot> {
  const claudeDir = options.claudeDir ?? createNodeEnvSource().getClaudeDir();
  const sources = {
    clock: createSystemClockSource(),
    sessions: createNodeSessionsSource(claudeDir),
    transcripts: createNodeTranscriptSource(claudeDir),
    subagents: createNodeSubagentSource(),
    toolLog: createNodeToolLogSource(),
    proc: createProcSource(),
  };
  const result = await orchestratorCollectOnce(sources, {
    watchMs: 0,
    thresholds: DEFAULT_STATUS_THRESHOLDS,
  });
  return applyFilter({ atMs: result.atMs, instances: result.instances }, filter);
}

function applyFilter(snap: Snapshot, filter: Filter): Snapshot {
  if (!filter) return snap;
  const needle = filter.toLowerCase();
  const filtered: Instance[] = snap.instances.filter((i) => {
    return [i.project, i.branch, i.model, i.sessionId, i.sessionName]
      .filter((s): s is string => Boolean(s))
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  return { atMs: snap.atMs, instances: filtered };
}
