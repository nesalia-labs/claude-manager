# claude-manager — Product Documents

This folder holds the product-side documentation for **claude-manager**, a Windows terminal dashboard for monitoring live Claude Code sessions, organized by project, with drill-down into subagents and tool activity.

**Reference:** claude-manager is the Windows port of [cctop (stefanprodan)](https://github.com/stefanprodan/cctop). Same architectural model, same sub-agent awareness. See [competitor-landscape.md](./competitor-landscape.md) for the full comparison.

**Repo:** Turborepo monorepo + pnpm workspaces. The CLI lives at `packages/claude-manager/` (npm name `@claude-manager/cli`).

**Stack:** Node 22 LTS, npm distribution, TypeScript (`strict`), OpenTUI + React, vitest, ESLint, commander.js, MIT license.

The documents here are written for internal use: defining what we are building, why, and how v1 fits together. They are living documents — update them as decisions change.

## Index

| Document | Purpose |
| --- | --- |
| [product-overview.md](./product-overview.md) | Vision, problem statement, target user, scope, non-goals. The "why". |
| [mvp-spec.md](./mvp-spec.md) | Detailed v1 specification: features, acceptance criteria, out-of-scope list. |
| [user-stories.md](./user-stories.md) | Concrete user stories for v1. The "for whom, in which situations". |
| [architecture.md](./architecture.md) | How v1 works internally: data sources, modules, runtime flow. |
| [competitor-landscape.md](./competitor-landscape.md) | Existing tools in the space and what we learn from each. |
| [roadmap.md](./roadmap.md) | Post-v1 direction: what comes after the sharp tool. |

## Reading order

For a new contributor, read in this order:
1. `product-overview.md` — context and goals
2. `mvp-spec.md` — what v1 actually delivers
3. `architecture.md` — how it is built
4. `competitor-landscape.md` — how we differ from prior art
5. `roadmap.md` — where we are heading after v1

## Status

- v1: **planning** — no code written yet.
- Target: Windows-only, sharp tool with project grouping + subagent + tool log drill-down, ~2–3 weeks of focused work.
- Distribution: `npm` / `bunx`.