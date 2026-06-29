/**
 * Pure status derivation. No I/O, no `Date.now`. The caller passes `nowMs`.
 *
 * Three states: `running` (< runningMs since last activity, process alive),
 * `idle` (< idleMs since last activity, process alive), `done`
 * (process gone or idleMs+ exceeded).
 */

import type { SessionStatus, StatusThresholds } from "../types.js";
import { DEFAULT_STATUS_THRESHOLDS } from "../types.js";

export interface DeriveStatusInput {
  /** Process liveness; null means unknown / not yet checked. */
  readonly processAlive: boolean;
  /** Most recent registry `updatedAt` or transcript mtime (epoch ms). */
  readonly lastMs: number;
  /** Current time (epoch ms). Caller-provided for testability. */
  readonly nowMs: number;
  /** Thresholds for the idle window; default = DEFAULT_STATUS_THRESHOLDS. */
  readonly thresholds?: StatusThresholds;
  /** Registry `status` field if known ("busy"/"idle"/etc.). */
  readonly registryStatus?: string | null;
}

export function deriveStatus(input: DeriveStatusInput): SessionStatus {
  const t = input.thresholds ?? DEFAULT_STATUS_THRESHOLDS;

  if (!input.processAlive) return "done";

  const ageMs = input.nowMs - input.lastMs;
  if (ageMs < 0) return "running"; // clock skew — treat as live
  if (ageMs < t.runningMs) return "running";
  if (ageMs < t.idleMs) return "idle";
  return "done";
}
