/**
 * Public surface of `@claude-manager/core`. Stable; everything else is
 * reachable only via deep imports under `@claude-manager/core/internal/*`.
 */

export { VERSION } from "./version.js";
export { CoreError, type CoreErrorKind } from "./errors.js";
export { createCollector } from "./collector.js";
export { collectOnce } from "./once.js";

export type {
  Collector,
  CollectorEvent,
  CollectorOptions,
  Filter,
  Instance,
  OrphanPort,
  SessionStatus,
  Snapshot,
  StatusThresholds,
  SubAgent,
  SubProc,
  ToolLogEntry,
  Unsubscribe,
} from "./types.js";

export { DEFAULT_STATUS_THRESHOLDS, isInstance, isSubAgent } from "./types.js";