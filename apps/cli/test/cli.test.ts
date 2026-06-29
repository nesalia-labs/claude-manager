/**
 * CLI smoke tests. Run the compiled binary with various flags and assert
 * the output shape. Skipped if no `dist/` has been built (i.e. `pnpm build`
 * wasn't run).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CLI_DIR = join(__dirname, "..");
const BIN = process.execPath;
const ENTRY = join(CLI_DIR, "dist", "cli.js");

const HAS_DIST = existsSync(ENTRY);

// Skip every test when dist/ is missing — building is the consumer's job.
const itIfBuilt = HAS_DIST ? it : it.skip;

function run(args: readonly string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(BIN, [ENTRY, ...args], {
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("cli — smoke", () => {
  itIfBuilt("--help exits 0 and prints usage", () => {
    const r = run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage:\s+claude-manager/);
    expect(r.stdout).toMatch(/--json/);
    expect(r.stdout).toMatch(/--once/);
    expect(r.stdout).toMatch(/--watch/);
  });

  itIfBuilt("--version exits 0 and prints the package version", () => {
    const r = run(["--version"]);
    expect(r.status).toBe(0);
    const pkg = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8"));
    expect(r.stdout.trim()).toBe(pkg.version);
  });

  itIfBuilt("--json exits 0 and emits a valid Snapshot JSON", () => {
    const r = run(["--json"]);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toHaveProperty("atMs");
    expect(parsed).toHaveProperty("instances");
    expect(Array.isArray(parsed.instances)).toBe(true);
  });

  itIfBuilt("--once exits 0 and prints a frame", () => {
    const r = run(["--once"]);
    expect(r.status).toBe(0);
    // First line is the header; should mention "session(s)".
    expect(r.stdout.split("\n")[0]).toMatch(/claude-manager v/);
  });

  itIfBuilt("rejects invalid --watch values", () => {
    const r = run(["--watch", "0.1"]);
    expect(r.status).not.toBe(0);
    const combined = r.stdout + r.stderr;
    expect(combined).toMatch(/invalid watch interval/);
  });

  itIfBuilt("rejects unknown options", () => {
    const r = run(["--no-such-flag"]);
    expect(r.status).not.toBe(0);
  });

  itIfBuilt("--json respects a substring filter", () => {
    const r = run(["--json", "definitely-not-a-real-project"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.instances).toEqual([]);
  });
});