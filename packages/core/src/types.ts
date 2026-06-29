/**
 * Public domain types — the entire data model the renderer sees.
 *
 * Adding a field here is **stable**. Removing or renaming is **breaking**.
 * Internal helpers (e.g. `Details`, `Proc`, `Session`) live in `internal/` and
 * are not part of the public surface.
 */

/** Filter as a substring (matches project, host, branch, model, session id, name). */
export type Filter = string | null;

/** Window of inactivity (in ms) that decides a session's status. */
export interface StatusThresholds {
  /** below this idle ms, status is `running` */
  readonly runningMs: number;
  /** below this idle ms, status is `idle`; above (or process gone), `done` */
  readonly idleMs: number;
}

export const DEFAULT_STATUS_THRESHOLDS: StatusThresholds = {
  runningMs: 5_000,
  idleMs: 60_000,
};

/** Status of a Claude Code session from the renderer's perspective. */
export type SessionStatus = "running" | "idle" | "done";

/** A live sub-agent spawned by a session via the `Agent` tool. */
export interface SubAgent {
  readonly model: string | null;
  readonly ctx: number | null;
  readonly activity: string | null;
  readonly uptimeSec: number;
}

/** A single tool invocation logged from a session's transcript. */
export interface ToolLogEntry {
  readonly toolUseId: string;
  readonly tool: string;
  readonly target: string;
  readonly status: "pending" | "done" | "error";
  readonly atMs: number;
  readonly durationMs?: number;
}

/** A sub-process of a session (a tool shell, MCP server, etc.). */
export interface SubProc {
  readonly pid: number;
  readonly name: string;
  readonly mem: number;
  readonly cpu: number;
  readonly uptimeSec: number;
  readonly ports: readonly number[];
}

/** A listener reparented to init (the parent that spawned it has exited). */
export interface OrphanPort {
  readonly pid: number;
  readonly name: string;
  readonly ports: readonly number[];
}

/** A single row in the dashboard. The renderer never sees more than this. */
export interface Instance {
  readonly pid: number;
  readonly sessionId: string | null;
  readonly sessionName: string | null;
  readonly project: string | null;
  readonly projectEncoded: string | null;
  readonly branch: string | null;
  readonly model: string | null;
  readonly contextTokens: number | null;
  readonly status: SessionStatus;
  readonly uptimeSec: number;
  readonly lastMs: number;
  readonly prompt: string | null;
  readonly processAlive: boolean;
  readonly transcript: string | null;
  readonly subagents: readonly SubAgent[];
  readonly children: readonly SubProc[];
  readonly orphanPorts: readonly OrphanPort[];
  readonly toolLog: readonly ToolLogEntry[];
}

/** A snapshot is the ordered set of `Instance`s at a point in time. */
export interface Snapshot {
  readonly atMs: number;
  readonly instances: readonly Instance[];
}

/** A `CollectorOptions` configures a single `createCollector` call. */
export interface CollectorOptions {
  /** Substring filter — same semantics as `matchRow` in cctop. */
  readonly filter?: Filter;
  /** Override the data directory (default: `$CLAUDE_CONFIG_DIR` or `~/.claude`). */
  readonly claudeDir?: string;
  /** Refresh interval in ms (default 1000). */
  readonly watchMs?: number;
  /** Custom status thresholds; default is `DEFAULT_STATUS_THRESHOLDS`. */
  readonly statusThresholds?: StatusThresholds;
}

/** Event emitted by a `Collector`. */
export type CollectorEvent =
  | { readonly kind: "ready"; readonly snapshot: Snapshot; readonly atMs: number }
  | { readonly kind: "add"; readonly instance: Instance; readonly atMs: number }
  | { readonly kind: "update"; readonly pid: number; readonly instance: Instance; readonly atMs: number }
  | { readonly kind: "remove"; readonly pid: number; readonly atMs: number }
  | { readonly kind: "warning"; readonly source: "transcript" | "registry" | "proc"; readonly message: string; readonly atMs: number }
  | { readonly kind: "error"; readonly error: Error; readonly atMs: number };

export interface Unsubscribe {
  (): void;
}

/** A `Collector` owns polling, caching, and event emission. */
export interface Collector {
  /** Read the latest snapshot. Cheap — returns the internal array. */
  snapshot(): Snapshot;
  /** Subscribe to events. Returns an `Unsubscribe`. */
  subscribe(listener: (event: CollectorEvent) => void): Unsubscribe;
  /** Force a refresh outside the polling tick. */
  refresh(): Promise<Snapshot>;
  /** Stop polling, release file handles, clear caches. */
  close(): Promise<void>;
}

// -- Type guards --------------------------------------------------------------

export const isInstance = (x: unknown): x is Instance =>
  typeof x === "object" && x !== null && "pid" in (x as Record<string, unknown>);

export const isSubAgent = (x: unknown): x is SubAgent =>
  typeof x === "object" && x !== null && "activity" in (x as Record<string, unknown>);
