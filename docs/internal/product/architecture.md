# Architecture — claude-manager v1

> **Status:** v1 plan rebuilt around the senior architecture refactor (2026-06-29). The monorepo is now split into a headless library (`packages/core/`, `@claude-manager/core`) and a CLI binary (`apps/cli/`, `@claude-manager/cli`). Renderers other than the TUI (web, VS Code) are out of scope for v1 but the boundary is set to make them cheap to add later.

## Guiding principles

1. **The library owns the truth; the UI owns the picture.** `core` produces data and emits events. `cli` decides how to display them.
2. **The boundary is typed, not string-shaped.** Every input/output that crosses a layer is a TypeScript interface in a leaf module. A renderer never sees a raw `pid`+`path`; it gets an `Instance`. A collector never sees a `ReactNode`; it gets `string | null`.
3. **No global mutable state survives a single function call.** Caches live on `Collector` instances — two collectors in the same process do not share state.

## Repo layout

```
claude-manager/                            ← Turborepo root
├── apps/
│   └── cli/                              ← @claude-manager/cli (the binary)
├── packages/
│   └── core/                             ← @claude-manager/core (headless library)
├── docs/                                 ← product + engineering docs
├── temp/cctop/                           ← vendored cctop reference (read-only)
├── package.json                          ← root: workspace + dev tooling
├── pnpm-workspace.yaml                   ← ["apps/*", "packages/*"]
├── turbo.json                            ← pipelines
├── tsconfig.base.json                    ← shared TS (strict + ES2022 + ESNext)
└── eslint.config.js                      ← shared ESLint flat config
```

`apps/cli` depends on `@claude-manager/core: workspace:*`. `core` has zero UI dependencies.

## Stack

- **Node 22 LTS** minimum (`engines.node` in each `package.json`).
- **TypeScript** with `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- **pnpm 9** + **Turborepo 2** (pinned via Corepack).
- **vitest** for tests; **ESLint 9** (flat config) for lint.
- **`@opentui/core` + `@opentui/react`** for the TUI (only in `apps/cli`).
- **`commander`** for CLI arg parsing.
- **No FFI** in v1. Windows proc layer = `tasklist /FO CSV /NH` + `netstat -ano` (signed Microsoft binaries; safe under Sentinel One / no-admin).
- **MIT** license.

## `@claude-manager/core` — layered architecture

Six layers, each with a clear I/O contract and a one-way dependency flow:

```
   0. types         (pure types, leaf)
   1. sources/*     (I/O — node:fs, node:child_process, ProcSource)
   2. domain/*      (pure functions over typed records — NO I/O)
   3. orchestrator  (sources + domain composition, emits diff events)
   4. snapshot      (internal state: Map<pid, Instance> + listeners)
   5. facade        (createCollector, collectOnce — the public API)
```

### 0. `types.ts` — public types

The stable surface. Adding a field is non-breaking; removing/renaming is breaking.

```ts
export interface Instance {
  readonly pid: number;
  readonly sessionId: string | null;
  readonly sessionName: string | null;
  readonly project: string | null;
  readonly projectEncoded: string | null;
  readonly branch: string | null;
  readonly model: string | null;
  readonly contextTokens: number | null;
  readonly status: "running" | "idle" | "done";
  // ... etc.
}

export interface Collector {
  snapshot(): Snapshot;
  subscribe(listener: (event: CollectorEvent) => void): Unsubscribe;
  refresh(): Promise<Snapshot>;
  close(): Promise<void>;
}

export type Filter = string | null;
export type SessionStatus = "running" | "idle" | "done";
export type CollectorEvent =
  | { kind: "ready";   ... }
  | { kind: "add";     ... }
  | { kind: "update";  ... }
  | { kind: "remove";  ... }
  | { kind: "warning"; ... }
  | { kind: "error";   ... };
```

### 1. `sources/*` — I/O confined here

All filesystem, process, and env reads. Each source exposes a small interface; the rest of core consumes the interface, not the implementation.

| File | Role |
| --- | --- |
| `sources/env.ts` | `createNodeEnvSource(env?)` — reads `CLAUDE_CONFIG_DIR` with `~` expansion. |
| `sources/clock.ts` | `createSystemClockSource()` / `createFixedClockSource(t)`. |
| `sources/sessions.ts` | `createNodeSessionsSource(claudeDir)` — reads `~/.claude/sessions/<pid>.json`. |
| `sources/transcript.ts` | `createNodeTranscriptSource(claudeDir)` — JSONL tail reader with mtime cache. |
| `sources/proc/index.ts` | `createProcSource()` — picks platform implementation. |
| `sources/proc/windows.ts` | `tasklist` subprocess. Other fields (`cwd`, `startSec`) returned as `null`/`0` until FFI replaces it. |
| `sources/proc/types.ts` | `Proc`, `ProcSource` interface (cctop-shaped). |

Each `create*` returns an object with the methods the orchestrator needs. **No globals, no module-level caches.**

### 2. `domain/*` — pure functions, no I/O

The testability dividend. **No `node:fs`, no `Date.now()`, no `process.env`.** Enforced by ESLint `no-restricted-imports` and `no-restricted-syntax` on `src/domain/**`.

| File | Role |
| --- | --- |
| `domain/status.ts` | `deriveStatus({...})` — pure, takes `nowMs`. |
| `domain/session.ts` | `parseSession(raw, file)` — defensive validator. |
| `domain/transcript.ts` | `noteEntry(details, entry)` + `detailsAreComplete()` — accumulator walker. |
| `domain/tool.ts` | `describeAssistant(message)` + `contextTokens(usage)`. |
| `domain/filter.ts` | `matchFilter(instance, filter)` — substring match. |

### 3. `orchestrator.ts` — internal: `collectOnce` orchestrator

Composes sources + domain in one async function:

1. Read the registry.
2. Read the process table.
3. For each session, discover + read the transcript.
4. Apply `deriveStatus` per row.
5. Emit warnings on partial failures (no throws).
6. Prune transcript cache to live paths.

Returns `{ atMs, instances: Instance[] }`. No state held between calls.

### 4. `snapshot.ts` — internal: `SnapshotStore`

Owns the mutable `Map<pid, Instance>` for a single Collector. Computes diff events (`add` / `update` / `remove`) on each refresh by structural comparison. Holds the listener set. Cleared by `collector.close()`.

### 5. Public facade — `index.ts` (8 exports)

```ts
export const VERSION = "0.1.0";
export class CoreError extends Error { ... kind: CoreErrorKind }
export { createCollector, collectOnce };

export type {
  Collector, CollectorEvent, CollectorOptions,
  Filter, Instance, OrphanPort, SessionStatus,
  Snapshot, StatusThresholds, SubAgent, SubProc, Unsubscribe,
} from "./types.js";
export { DEFAULT_STATUS_THRESHOLDS, isInstance, isSubAgent } from "./types.js";
```

That's it. Tests / fixtures live under `@claude-manager/core/internal/*` — opt-in only.

## `@claude-manager/cli` — the binary

Thin package. Owns:
- `src/cli.ts` — `commander` argv parser + mode dispatch (json / text / live).
- `src/render/{json,text}.ts` — one-shot frame renderers.
- `src/tui/run.ts` — opens an OpenTUI `createCliRenderer`, mounts the React tree, handles Ctrl+C and `collector.close()`.
- `src/tui/App.tsx` — React component tree consuming `Collector.snapshot()` + `Collector.subscribe()`.

```
$ claude-manager                    → live TUI (requires TTY)
$ claude-manager --once             → plain-text frame, exit
$ claude-manager --json             → JSON snapshot, exit
$ claude-manager [filter]           → live with substring filter
$ claude-manager --claude-dir PATH  → override data dir
```

`cli` never reads `~/.claude/`, never parses a JSONL line, never reads `process.env` for `CLAUDE_CONFIG_DIR`. It instantiates a `Collector` (or calls `collectOnce`) and renders.

## Error model

- **Missing `~/.claude`** → empty `Instance[]`, no throw.
- **Partial / malformed JSONL** → skip line, emit `warning` event.
- **Process table read failure** → registry-only mode (cctop-style degradation).
- **Programmer errors** → `CoreError { kind: "internal" }` thrown. The CLI stack-traces and exits non-zero.
- **Process snapshot error** → `error` event delivered to subscribers; TUI shows a yellow dot.

## Caches

Three caches total. All live on `Collector` instances, not modules:

1. **Transcript mtime cache** — `Map<path, { mtimeMs, details }>` inside `sources/transcript.ts`. Pruned each cycle to the live path set.
2. **Subagent cache (Phase 2)** — same pattern, per collector.
3. **CPU sample cache (Phase 2)** — same pattern, per collector.

Two collectors in the same process never share these maps.

## Memory and time abstraction

- **Time**: `nowMs` is a parameter passed down from `ClockSource`. `domain/` never calls `Date.now()`.
- **Env**: `EnvSource.get()` reads from a captured `process.env` snapshot. Production captures once at startup; tests inject.
- **Path**: Claude dirs are passed as args to `create*Source(...)` factories. `domain/` never knows where `~/.claude/` lives.

## Call graph (no cycles)

```
index.ts
  ├─ collector.ts (createCollector)
  │    ├─ orchestrator.ts ◄─ sources/* and domain/*
  │    └─ snapshot.ts
  └─ once.ts (collectOnce)
       └─ orchestrator.ts
```

Hard rules, ESLint-enforced:

- `domain/*` cannot import `sources/*`, `node:fs`, `node:os`, `node:child_process`, `node:process`.
- `sources/*` never imports `domain/*` (sources return records; orchestrator applies domain).
- `core/*` never imports React or OpenTUI.
- `cli/*` never talks to `node:fs` directly for Claude data; only via `core`.

## Phased plan

| Phase | Scope | Status |
| --- | --- | --- |
| **v0.1 — sharp tool** | Live sessions list + project grouping + subagents + tool log (TUI). | Current. Skeleton + collector + Windows subprocess ready; OpenTUI wiring in `apps/cli/src/tui/run.ts` next. |
| v0.2 — Telemetry | Token counts per session, status counters, basic charts. | — |
| v0.3 — Scripting | `--json --filter foo` round-trips, `--once` parity with `--json`. | — |
| v1.0 — Public release | npm publish `@claude-manager/cli` + `@claude-manager/core`. Stable API surface declared in `index.ts`. | — |

## Open architectural questions

- **Cross-platform**: macOS + Linux `ProcSource` impls are post-v1.
- **TSDoc / generated docs site**: `@claude-manager/core` types are stable enough to publish with `typedoc`. v1.x task.
- **Test snapshot policy**: render assertions live next to pure-function tests. OpenTUI components (`apps/cli/src/tui/`) get integration-style tests once we mount the real renderer.
- **`--debug` / internal flag**: not in v1.x. Operators can set `CLAUDE_MANAGER_DEBUG=1` and we'll plumb it later if useful.

## Files referenced in this doc

- Root config: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`.
- Library: `packages/core/{package.json, tsconfig.json, tsconfig.build.json, eslint.config.js, README.md}` plus `packages/core/src/{index,collector,once,snapshot,types,errors,version,orchestrator}.ts`, `packages/core/src/domain/*.ts`, `packages/core/src/sources/**/*.ts`, `packages/core/src/internal/__test-helpers.ts`, plus `packages/core/test/**/*.test.ts`.
- Binary: `apps/cli/{package.json, tsconfig.json, tsconfig.build.json, eslint.config.js, README.md}`, `apps/cli/src/cli.ts`, `apps/cli/src/tui/run.ts`.
- Reference impl: `temp/cctop/`.