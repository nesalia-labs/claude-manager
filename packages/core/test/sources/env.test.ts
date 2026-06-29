import { homedir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNodeEnvSource, resolveClaudeDir } from "../../src/sources/env.js";

describe("sources/env — resolveClaudeDir", () => {
  const ORIGINAL = process.env["CLAUDE_CONFIG_DIR"];

  beforeEach(() => {
    delete process.env["CLAUDE_CONFIG_DIR"];
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env["CLAUDE_CONFIG_DIR"];
    else process.env["CLAUDE_CONFIG_DIR"] = ORIGINAL;
  });

  it("defaults to ~/.claude when unset", () => {
    expect(resolveClaudeDir({})).toBe(join(homedir(), ".claude"));
  });

  it("defaults to ~/.claude when empty/whitespace", () => {
    expect(resolveClaudeDir({ CLAUDE_CONFIG_DIR: "   " })).toBe(
      join(homedir(), ".claude"),
    );
  });

  it("expands ~", () => {
    expect(resolveClaudeDir({ CLAUDE_CONFIG_DIR: "~" })).toBe(homedir());
  });

  it("expands ~/foo", () => {
    expect(resolveClaudeDir({ CLAUDE_CONFIG_DIR: "~/test-claude" })).toBe(
      join(homedir(), "test-claude"),
    );
  });

  it("passes absolute paths through unchanged", () => {
    expect(resolveClaudeDir({ CLAUDE_CONFIG_DIR: "C:/tmp/custom" })).toBe("C:/tmp/custom");
  });
});

describe("sources/env — createNodeEnvSource", () => {
  it("returns a source whose getClaudeDir honors CLAUDE_CONFIG_DIR", () => {
    const src = createNodeEnvSource({ CLAUDE_CONFIG_DIR: "/tmp/x" });
    expect(src.getClaudeDir()).toBe("/tmp/x");
  });

  it("returns a source whose get reads the provided env", () => {
    const src = createNodeEnvSource({ FOO: "bar" });
    expect(src.get("FOO")).toBe("bar");
    expect(src.get("UNSET")).toBeUndefined();
  });
});
