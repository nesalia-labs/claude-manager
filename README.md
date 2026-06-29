# claude-manager

> A Windows terminal dashboard for monitoring live [Claude Code](https://code.claude.com) sessions, organized by project, with drill-down into subagents and tool activity.

## Why

Claude Code can run multiple sessions in parallel — across different terminals, IDE windows, worktrees, and git branches. Each session may itself spawn subagents (Explore, Plan, general-purpose) which in turn make their own tool calls. There is no built-in way to see this hierarchy at a glance.

`claude-manager` is a single TUI that lists every live Claude Code session on your machine, grouped by project, with a per-session drill-down into subagents and tool activity. Strictly read-only. Windows-first.

## Install

```sh
npm install -g @claude-manager/cli
```

Requires **Node.js 22 LTS** or newer.

## Run

```sh
claude-manager
```

Press `q` to quit. Press `?` for help.

## Features (v1)

- **Project grouping** — every live Claude Code session, organized by working directory.
- **Live status** — `running` / `idle` / `done` for each session, auto-updating.
- **Subagents** — see the Explore, Plan, and general-purpose agents each session has spawned.
- **Tool log** — chronological stream of every tool call (`Read`, `Edit`, `Bash`, `Grep`, etc.) per session.
- **Live updates** — fs.watch on `~/.claude/` plus a polling fallback.
- **Read-only** — never writes to `~/.claude/`, never injects prompts, never stops sessions.

## How it works

`claude-manager` reads from `~/.claude/` (the per-PID session registry at `sessions/<pid>.json` and the per-session transcripts at `projects/<encoded>/<id>.jsonl`) and the Windows process table (via `tasklist` / `netstat`). No FFI, no system calls — just signed Microsoft subprocesses. The tool is fully read-only.

The architecture is modeled closely on [`cctop` (stefanprodan)](https://github.com/stefanprodan/cctop), which is the reference implementation for the data model and the TUI patterns. We depart from cctop on runtime (Node instead of Bun) and on platform (Windows instead of macOS/Linux).

See `docs/internal/product/` for the full product documents (overview, MVP spec, architecture, user stories, competitor landscape, roadmap).

## Status

**Pre-alpha.** v1 is in planning. The product documents are stable; the code skeleton is being set up. See the [MVP spec](./docs/internal/product/mvp-spec.md) for what v1 will deliver.

## Development

This is a [Turborepo](https://turbo.build/) monorepo with [pnpm workspaces](https://pnpm.io/workspaces).

```sh
# Install dependencies for all packages
pnpm install

# Build everything
pnpm build

# Run tests across the workspace
pnpm test

# Lint everything
pnpm lint

# Type-check everything
pnpm typecheck

# Work on the CLI in watch mode
pnpm --filter @claude-manager/cli dev
```

Requires **pnpm 9+** (use [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

## Repo layout

```
claude-manager/
├── apps/
│   └── cli/                      ← @claude-manager/cli (the binary, npm-published)
├── packages/
│   └── core/                     ← @claude-manager/core (headless library, npm-published)
├── docs/
│   └── internal/product/         ← product docs (overview, MVP, architecture, etc.)
├── temp/
│   └── cctop/                    ← vendored reference clone of cctop (read-only)
├── package.json                  ← root: workspace + dev tooling
├── pnpm-workspace.yaml           ← apps/* + packages/*
├── turbo.json
├── tsconfig.base.json            ← shared TS config (strict + ES2022 + ESNext)
├── eslint.config.js              ← shared ESLint flat config
└── LICENSE                       ← MIT
```

`@claude-manager/cli` depends on `@claude-manager/core` via `workspace:*`. The library has zero UI deps; the binary adds OpenTUI + React. See `docs/internal/product/architecture.md` for the layered model.

## License

MIT — see [`LICENSE`](./LICENSE).