# @claude-manager/cli

> Windows terminal dashboard for monitoring live Claude Code sessions.

Part of the [`claude-manager`](https://github.com/nesalia-labs/claude-manager) monorepo. Thin CLI over [`@claude-manager/core`](../core).

## Install

```sh
npm install -g @claude-manager/cli
```

Requires **Node.js 22 LTS** for `--help`, `--once`, `--json`.

The interactive **TUI mode** additionally requires **Node.js 26.3+** (native FFI) or **Bun 1.3+**. Older runtimes get a clear error and can fall back to `--once` / `--json` for a plain-text or JSON snapshot.

## Run

```sh
claude-manager                                # interactive TUI (requires Node 26.3+ or Bun)
claude-manager --once                         # single text frame, exit
claude-manager --json                         # single JSON snapshot, exit
claude-manager [filter]                       # substring filter on project / branch / model / id
claude-manager --claude-dir PATH              # override data dir
```

See `--help` for the full list.

## Features (v1)

- Project-grouped list of every live Claude Code session on the machine.
- Per-session status: `running` / `idle` / `done`.
- Subagents list (Explore, Plan, general-purpose, custom) — v0.2.
- Tool log per session (`Read`, `Edit`, `Bash`, `Grep`) — v0.2.
- Live updates via `@claude-manager/core` polling.
- Strictly read-only.

## Architecture

Two surfaces: `@claude-manager/core` (headless library, zero UI deps) does all the data work; `@claude-manager/cli` is one consumer and provides the argv parser + renderers + OpenTUI mount. The TUI is loaded lazily so the JSON / `--once` paths work on Node 22. See `docs/internal/product/architecture.md`.

## License

MIT — see [`LICENSE`](../../LICENSE).