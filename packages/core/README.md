# @claude-manager/core

> Headless library for collecting live Claude Code session data.

Part of the [`claude-manager`](https://github.com/your-org/claude-manager) monorepo.

`@claude-manager/core` is renderer-agnostic. The CLI binary (`@claude-manager/cli`) is one consumer; a web dashboard, a VS Code extension, or a test script could be another.

## Install

```sh
npm install @claude-manager/core
```

Requires **Node.js 22 LTS** or newer.

## Public API

```ts
import { createCollector, collectOnce, VERSION, CoreError } from "@claude-manager/core";
import type { Instance, SubAgent, CollectorEvent } from "@claude-manager/core";
```

| Export | Purpose |
| --- | --- |
| `VERSION` | Package version (semver-safe). |
| `CoreError` | Typed error class with `kind` discriminator. |
| `createCollector(opts)` | Returns a `Collector` that snapshots on a refresh tick and emits events. |
| `collectOnce(filter, opts?)` | One-shot snapshot. For `--once`, `--json`, scripts, tests. |
| Types: `Instance`, `SubAgent`, `SubProc`, `Snapshot`, `Collector`, `CollectorEvent`, `CollectorOptions`, `Filter` | The data the renderer sees. |

Anything not listed above is **internal** and reachable only via `@claude-manager/core/internal/*` deep imports. Internal APIs are semver-unsafe.

## Concepts

- **Pure domain** — every status derivation, prompt extraction, filter match is a pure function over typed inputs. No filesystem reads, no clock reads, no env reads.
- **I/O confined to `sources/`** — only the source layer imports `node:fs`, `node:child_process`, etc.
- **Snapshot + events** — `Collector` keeps an in-memory snapshot and emits `add` / `update` / `remove` / `warning` / `error` events. Renderers re-pull `snapshot()` rather than mutating per-event.
- **No global state** — caches live on each `Collector` instance. Two collectors in the same process do not share state.

## Status

Pre-alpha. v1 in planning; see the [product docs](../../docs/internal/product/) in the monorepo root.

## License

MIT — see [`LICENSE`](../../LICENSE) in the monorepo root.