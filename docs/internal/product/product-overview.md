# Product Overview — claude-manager

## One-liner

**claude-manager** is a Windows terminal dashboard that shows every Claude Code session on your machine, grouped by project, with per-session drill-down into subagents and tool activity. Powered by OpenTUI, distributed via `bunx`.

## Reference

This product is, intentionally, the **Windows port of [cctop (stefanprodan)](https://github.com/stefanprodan/cctop)** — same Bun + TypeScript stack, same "top-style" monitor domain, same sub-agent awareness. cctop ships for macOS/Linux only and includes an opt-in `x` to SIGTERM sessions. We ship for Windows only and are strictly read-only. See [competitor-landscape.md](./competitor-landscape.md) for the full comparison.

## The problem

Claude Code routinely runs multiple sessions in parallel — across different terminals, IDE windows, worktrees, and git branches. Each session may itself spawn multiple subagents (Explore, Plan, general-purpose, custom) which in turn spawn their own tool calls. There is no built-in way to see this hierarchy at a glance.

Concrete symptoms this causes:

- You have three terminals open and forget which one is doing what.
- A session is silently waiting for input and you didn't notice.
- A session spawned four Explore agents to research your codebase and you don't know which have finished.
- A session has been stuck on a tool call for ten minutes and you can't see which tool.
- You want to know which project each session is working on without alt-tabbing into each terminal.

Claude Code stores everything on disk — session transcripts, subagent sidechain transcripts, event logs, token stats, history — but it does not aggregate them into a single live, navigable view. Users have to manually inspect each terminal and each JSONL file.

## Target user

**Software developers** who use Claude Code heavily on Windows and routinely run more than one session in parallel, often on different projects. Comfortable with terminals, command-line tools, and JSON-on-disk data sources.

This is *not* aimed at non-technical users, enterprise admins, or teams running a shared CC backend. claude-manager is a single-user, local, read-only observability tool.

## What it is (v1)

A single TUI screen showing a live, project-grouped tree of every Claude Code session on the local Windows machine, with drill-down into subagents and tool logs.

Key properties:

- **Local only** — reads from `~/.claude/` and Windows process APIs. No server, no network, no auth.
- **Read-only** — never writes back to Claude Code data, never injects prompts, never stops sessions.
- **Windows-first** — primary supported OS. Other OSes may work but are explicitly not a v1 goal.
- **Project grouping** — sessions are organized by their working directory (project). Each project groups its sessions.
- **Three-level drill-down** — project → session → subagent / tool log. No deeper navigation in v1.
- **Live updates** — fs.watch + polling, no CC hooks or plugins to install.

## What it is not (non-goals)

- Not an analytics dashboard. No token charts, no cost estimates, no historical graphs in v1.
- Not a session controller. Cannot send prompts, cancel, or steer sessions.
- Not cross-platform. Linux/macOS are not v1 targets.
- Not a team product. No multi-user, no backend, no sync, no auth.
- Not a replacement for the Claude Code session picker. Complementary to it.

## Core v1 capabilities

| Capability | What you see |
| --- | --- |
| Project grouping | Every active project as a collapsible section; project name decoded from the encoded `~/.claude/projects/<encoded>/` directory |
| Session list (per project) | One row per session: name, status (idle / running / done), duration, model, last activity |
| Session detail | Subagent list + tool log for the focused session |
| Subagent list | Each `Agent` invocation: type (Explore / Plan / general-purpose / custom), status, model, duration |
| Tool log | Every `tool_use` block from the session in chronological order: tool name, target (file / command / etc.), timestamp, status |

## Why OpenTUI

OpenTUI gives us a native-Zig core with TypeScript bindings — fast redraws, modern component model, and a published npm package. We adopt its React bindings for the drill-down UI (subagent + tool log panes).

Alternatives considered and rejected for v1:

- **Textual / Rich (Python)** — works, but Python's packaging on Windows is a tax we don't want.
- **ratatui (Rust)** — fast and proven, but the distribution story is "ship a binary", and we want a single `npm install` for parity with the JS ecosystem Claude Code lives in.
- **Ink / blessed** — JS-native but slower redraws, less ergonomic for live-update layouts.
- **Hand-rolled ANSI (cctop's choice)** — zero npm deps but expensive UI work; rejected in favor of OpenTUI's component model for the multi-pane drill-down.

## Stack (decided 2026-06-29)

| Layer | Choice |
| --- | --- |
| Runtime | **Node 22 LTS minimum** |
| Distribution | **`npm install -g @claude-manager/cli`** → `claude-manager` CLI (npm-published package) |
| Repo structure | **Turborepo monorepo + pnpm workspaces** (`packages/claude-manager/`) |
| Language | TypeScript (`strict: true`) |
| TUI | `@opentui/core` + `@opentui/react` (React bindings) |
| Test runner | **vitest** |
| Linter | **ESLint** (`eslint:recommended` + `plugin:@typescript-eslint/recommended`) |
| CLI parser | **commander.js** |
| Build | `tsc` (emit to `dist/`) + `tsx` (dev) |
| License | **MIT** |
| Windows proc layer | `tasklist /FO CSV /V` + `netstat -ano` (subprocess; FFI to ntdll avoided due to Sentinel One EDR + no admin rights on dev machine) |
| Package manager | **pnpm** (pinned via Corepack) |

## Repository layout

```
claude-manager/                       ← repo root
  package.json                        ← root: devDeps (turbo, pnpm, eslint, vitest, tsx)
  pnpm-workspace.yaml                 ← declares apps/* AND packages/*
  turbo.json                          ← pipelines: build, dev, test, lint, typecheck
  tsconfig.base.json                  ← shared TS config (strict, ES2022, ESNext)
  eslint.config.js                    ← shared ESLint flat config
  docs/                               ← product + engineering docs (this folder)
  apps/
    cli/                              ← @claude-manager/cli (the binary)
      package.json                    ← bin: claude-manager, deps: @claude-manager/core + OpenTUI + React
      src/cli.ts                      ← commander argv parser + mode dispatch
      src/render/{json,text}.ts       ← one-shot renderers
      src/tui/                         ← OpenTUI React mount (v0.2)
  packages/
    core/                              ← @claude-manager/core (the headless library)
      package.json                    ← zero UI deps, exports map with ./internal/*
      src/index.ts                     ← 8-line public API
      src/{collector,once,snapshot,types,errors,version,orchestrator}.ts
      src/domain/                       ← PURE helpers (eslint-enforced)
      src/sources/                      ← I/O (env, sessions, transcripts, proc)
```

Two surfaces: `apps/cli/` (the deployable binary, npm-published as `@claude-manager/cli`) and `packages/core/` (the headless library, npm-published as `@claude-manager/core`). `cli` consumes `core` via `workspace:*`. Future packages — e.g. `packages/docs/` for a VitePress site — slot in without restructuring. See [architecture.md](./architecture.md) for the full layering.

**Why we depart from cctop on runtime:** cctop is Bun-only. We target Node + pnpm for distribution reach and monorepo support. We also depart on tooling: cctop uses Biome — we use ESLint; cctop uses Bun test — we use vitest; cctop rolls its own CLI parser — we use commander.js; cctop is Apache 2.0 — we are MIT; cctop is single-package — we are a Turborepo monorepo.

## Success criteria for v1

A v1 is "done" when:

1. A user on Windows can run `bunx claude-manager` and see a live, project-grouped list of every Claude Code session on their machine, updating as state changes.
2. Each project section can be expanded/collapsed to reveal its sessions.
3. Each session shows: name (or summary), project path, branch, status (`idle` / `running` / `done`), duration, last activity.
4. Selecting a session reveals its subagents (if any) and tool log.
5. The subagent list shows type, model, status, and duration for each `Agent` invocation.
6. The tool log shows the chronological stream of every `tool_use` from the session, with tool name, target, timestamp, and status (running / done / errored).
7. Quitting the dashboard never modifies anything in `~/.claude/`.
8. The tool installs via `bunx` with no additional setup on a clean Windows + Bun install.

Anything beyond this is post-v1.