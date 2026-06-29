import { describe, expect, it } from "vitest";

import { contextTokens, describeAssistant } from "../../../src/domain/tool.js";

describe("domain/tool — contextTokens", () => {
  it("sums fresh input and both cache buckets", () => {
    expect(
      contextTokens({
        input_tokens: 100,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 25,
      }),
    ).toBe(175);
  });

  it("treats missing fields as zero", () => {
    expect(contextTokens({ input_tokens: 100 })).toBe(100);
    expect(contextTokens({})).toBe(0);
  });

  it("returns 0 for undefined usage", () => {
    expect(contextTokens(undefined)).toBe(0);
  });
});

describe("domain/tool — describeAssistant", () => {
  it("formats a Bash tool call", () => {
    expect(
      describeAssistant({
        content: [
          {
            type: "tool_use",
            name: "Bash",
            input: { command: "npm test", description: "Run tests" },
          },
        ],
      }),
    ).toBe("Bash: npm test");
  });

  it("formats a Read call with only the last path segment", () => {
    expect(
      describeAssistant({
        content: [
          {
            type: "tool_use",
            name: "Read",
            input: { file_path: "/Users/me/code/src/foo.ts" },
          },
        ],
      }),
    ).toBe("Read: foo.ts");
  });

  it("formats an Agent call via description", () => {
    expect(
      describeAssistant({
        content: [
          {
            type: "tool_use",
            name: "Agent",
            input: { description: "Audit the auth layer", subagent_type: "Explore" },
          },
        ],
      }),
    ).toBe("Agent: Audit the auth layer");
  });

  it("falls back to a text snippet when no tool_use is present", () => {
    expect(
      describeAssistant({ content: [{ type: "text", text: "On it." }] }),
    ).toBe("On it.");
  });

  it("returns null when content has neither tool_use nor text", () => {
    expect(describeAssistant({ content: [{ type: "thinking", thinking: "..." }] })).toBeNull();
  });

  it("returns null for non-array content", () => {
    expect(describeAssistant({ content: "string" })).toBeNull();
    expect(describeAssistant({})).toBeNull();
  });

  it("caps tool arguments at 120 characters", () => {
    const long = "x".repeat(500);
    expect(
      describeAssistant({
        content: [{ type: "tool_use", name: "Bash", input: { command: long } }],
      }),
    ).toBe(`Bash: ${"x".repeat(120)}`);
  });

  it("uses the most recent tool_use when several are present", () => {
    expect(
      describeAssistant({
        content: [
          { type: "tool_use", name: "Bash", input: { command: "ls" } },
          { type: "tool_use", name: "Read", input: { file_path: "/foo/bar.ts" } },
        ],
      }),
    ).toBe("Read: bar.ts");
  });
});
