/**
 * `EnvSource` — replaces every direct `process.env` read. Production code
 * captures the env once at startup; tests inject a fake.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export interface EnvSource {
  get(name: string): string | undefined;
  getClaudeDir(): string;
}

export function resolveClaudeDir(env: Record<string, string | undefined>): string {
  const override = env["CLAUDE_CONFIG_DIR"]?.trim();
  if (!override) return join(homedir(), ".claude");
  if (override === "~") return homedir();
  if (override.startsWith("~/")) return join(homedir(), override.slice(2));
  return override;
}

export function createNodeEnvSource(
  env: Record<string, string | undefined> = process.env,
): EnvSource {
  return {
    get: (name) => env[name],
    getClaudeDir: () => resolveClaudeDir(env),
  };
}
