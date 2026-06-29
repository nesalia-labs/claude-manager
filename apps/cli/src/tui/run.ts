/**
 * Mount the OpenTUI renderer + the React tree. Owns lifecycle:
 *   - createCliRenderer()
 *   - createCollector(core)
 *   - mount <App /> with keyboard routing
 *   - on exit: collector.close(), renderer.destroy()
 *
 * Per architecture doc: never reads `~/.claude/` directly. Never parses
 * JSONL. Never reads `process.env` for the data dir — that's `core`'s job.
 *
 * Shutdown is **idempotent** — `q`, Ctrl+C, and a SIGTERM can all fire in
 * the same instant. Double-destroying OpenTUI's renderer segfaults under
 * Bun, so the very first instruction of `shutdown()` is the `exited` guard.
 */

import { createElement } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import {
  createCollector,
  type Collector,
  type Filter,
} from "@claude-manager/core";

import { App } from "./app.js";

export interface RunTuiOptions {
  filter: Filter;
  claudeDir?: string;
  watchMs: number;
}

function waitForever(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export async function runTui(opts: RunTuiOptions): Promise<void> {
  const collector: Collector = createCollector({
    filter: opts.filter,
    claudeDir: opts.claudeDir,
    watchMs: opts.watchMs,
  });

  // useThread: true moves the native render loop onto a Node `worker_thread`,
  // which avoids a known Bun segfault in opentui.dll when the React tree
  // rapidly mounts/unmounts (e.g. during filter typing). Without this, the
  // crash surfaces as a hard segfault with the message blaming Bun.
  const renderer = await createCliRenderer({ exitOnCtrlC: false, useThread: true });
  const root = createRoot(renderer);

  // Populate the first snapshot synchronously so the TUI renders with data
  // immediately.
  try {
    await collector.refresh();
  } catch {
    // refresh can fail if no Claude data yet; the TUI will show 0 sessions
    // until the next tick populates the store.
  }

  const waiting = waitForever();

  // Idempotent shutdown — `q`, SIGINT, and SIGTERM can all race.
  let exited = false;
  // Suppress noisy teardown errors that would otherwise crash the process
  // before the async cleanup finishes. (OpenTUI's native teardown can race
  // with in-flight paints; we don't want an unhandled rejection to surface
  // as a hard segfault.)
  const swallow = (err: unknown): void => {
    void err;
  };
  const onUncaught = (err: unknown): void => {
    swallow(err);
  };
  const onUnhandled = (reason: unknown): void => {
    swallow(reason);
  };
  process.on("uncaughtException", onUncaught);
  process.on("unhandledRejection", onUnhandled);

  const shutdown = async (): Promise<void> => {
    if (exited) return;
    exited = true;

    // Detach signal handlers so a second Ctrl+C doesn't race.
    process.removeListener("SIGINT", onSigInt);
    process.removeListener("SIGTERM", onSigTerm);
    waiting.release();

    // 1) Unmount React tree (sync, fast). Doing this before destroy() lets
    //    the reconciler run any final commit synchronously.
    try {
      root.unmount();
    } catch (err) {
      swallow(err);
    }

    // 2) Yield to the event loop so any in-flight paint commits.
    await new Promise<void>((r) => setImmediate(r));

    // 3) Destroy the renderer (native teardown). Must happen after the
    //    React unmount, otherwise the reconciler may try to flush into a
    //    half-destroyed tree.
    try {
      renderer.destroy();
    } catch (err) {
      swallow(err);
    }

    // 4) Close the collector (clears the polling interval + cache).
    try {
      await collector.close();
    } catch (err) {
      swallow(err);
    }

    // 5) Detach our safety nets.
    process.removeListener("uncaughtException", onUncaught);
    process.removeListener("unhandledRejection", onUnhandled);
  };

  const onSigInt = (): void => {
    void shutdown();
  };
  const onSigTerm = (): void => {
    void shutdown();
  };
  process.on("SIGINT", onSigInt);
  process.on("SIGTERM", onSigTerm);

  root.render(createElement(App, { collector, onQuit: shutdown }));

  await waiting.promise;
  await shutdown();
}