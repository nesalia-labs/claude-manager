#!/usr/bin/env node
/**
 * `claude-manager` entry point.
 *
 * Three modes:
 *   --json    → one-shot JSON snapshot to stdout, exit.
 *   --once    → one-shot plain-text frame, exit.
 *   (default) → interactive TUI.
 *
 * The TUI mode is loaded lazily because @opentui/react's runtime requires
 * Node 26.3+ (native FFI) and the rest of the CLI is useful on older Node.
 */

import { Command } from "commander";

import { collectOnce, VERSION, type Filter } from "@claude-manager/core";

const program = new Command();

program
  .name("claude-manager")
  .description("Windows terminal dashboard for monitoring live Claude Code sessions")
  .version(VERSION)
  .argument("[filter]", "only show sessions whose project, host, branch, model, or session id contains this")
  .option("-w, --watch <seconds>", "refresh interval in seconds (default: 1, min: 0.25)", parseSeconds, 1)
  .option("--once", "render once and exit (default when piped)")
  .option("--json", "emit a single JSON snapshot and exit")
  .option("--claude-dir <path>", "override the Claude data directory (default: ~/.claude)")
  .allowExcessArguments(false)
  .parseAsync(process.argv)
  .then(async (cmd) => {
    const args = cmd.args as string[];
    const opts = cmd.opts<{
      watch: number;
      once?: boolean;
      json?: boolean;
      claudeDir?: string;
    }>();

    const filter: Filter = args[0] ?? null;

    if (opts.json) {
      const snap = await collectOnce(filter, { claudeDir: opts.claudeDir });
      process.stdout.write(JSON.stringify(snap, null, 2) + "\n");
      return;
    }

    const live = !opts.once && Boolean(process.stdout.isTTY && process.stdin.isTTY);

    if (!live) {
      const snap = await collectOnce(filter, { claudeDir: opts.claudeDir });
      const lines = renderFrame(snap);
      process.stdout.write(lines.join("\n") + "\n");
      return;
    }

    // Lazy import: OpenTUI's native renderer needs Node 26.3+ / Bun. Loading
    // it lazily keeps `--help`, `--json`, and `--once` working on Node 22
    // (and surfaces a clear error if the user tries live mode on an
    // unsupported runtime).
    try {
      const { runTui } = await import("./tui/run.js");
      await runTui({
        filter,
        claudeDir: opts.claudeDir,
        watchMs: Math.max(250, Math.floor(opts.watch * 1000)),
      });
    } catch (err) {
      console.error(
        `error: failed to load the TUI renderer — ${
          (err as Error).message
        }\n\nThe TUI requires Node 26.3+ (native FFI) or Bun 1.3+.\nFor older runtimes, run with --once or --json to get a plain-text snapshot.`,
      );
      process.exit(1);
    }
  })
  .catch((err: unknown) => {
    console.error(`error: ${(err as Error).message ?? String(err)}`);
    process.exit(1);
  });

function parseSeconds(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0.25) {
    throw new Error(`invalid watch interval: ${raw} (min 0.25)`);
  }
  return n;
}

function renderFrame(snap: {
  atMs: number;
  instances: readonly {
    pid: number;
    status: string;
    project: string | null;
    model: string | null;
  }[];
}): string[] {
  const out: string[] = [];
  out.push(
    `claude-manager v${VERSION} — ${snap.instances.length} session(s) at ${new Date(snap.atMs).toISOString()}`,
  );
  for (const r of snap.instances) {
    out.push(
      `  [${r.status.padEnd(7)}] pid=${String(r.pid).padEnd(6)} ${r.project ?? "?"} (${r.model ?? "?"})`,
    );
  }
  return out;
}
