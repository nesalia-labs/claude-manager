import { describe, expect, it } from "vitest";

import { isSubagentLive, parseSubagentTail } from "../../../src/domain/subagent.js";

describe("domain/subagent — isSubagentLive", () => {
  const nowMs = 1_700_000_000_000;

  it("is live if it wrote a turn in the last 20s", () => {
    expect(
      isSubagentLive({ mtimeMs: nowMs - 10_000, nowMs, running: false }),
    ).toBe(true);
  });

  it("is live if it wrote a turn in the last 20s even without a running tool", () => {
    expect(
      isSubagentLive({ mtimeMs: nowMs - 5_000, nowMs, running: false }),
    ).toBe(true);
  });

  it("is live if it is mid-flight within the busy window (180s)", () => {
    expect(
      isSubagentLive({ mtimeMs: nowMs - 60_000, nowMs, running: true }),
    ).toBe(true);
  });

  it("is dead if it has been quiet past 20s and not running", () => {
    expect(
      isSubagentLive({ mtimeMs: nowMs - 30_000, nowMs, running: false }),
    ).toBe(false);
  });

  it("is dead if it has been quiet past 180s even if mid-flight", () => {
    expect(
      isSubagentLive({ mtimeMs: nowMs - 200_000, nowMs, running: true }),
    ).toBe(false);
  });
});

describe("domain/subagent — parseSubagentTail", () => {
  it("extracts model + ctx + activity from the newest assistant turn", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { content: "go" } }),
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        message: {
          model: "claude-haiku-4-5",
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 5,
            cache_creation_input_tokens: 0,
          },
          content: [
            { type: "tool_use", name: "Bash", input: { command: "ls" } },
          ],
        },
      }),
    ];
    const got = parseSubagentTail(lines);
    expect(got.model).toBe("claude-haiku-4-5");
    expect(got.ctx).toBe(15);
    expect(got.activity).toBe("Bash: ls");
  });

  it("flags running=true when the last entry is an assistant tool_use", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        message: {
          model: "claude-haiku-4-5",
          usage: { input_tokens: 5 },
          content: [
            { type: "tool_use", name: "Read", input: { file_path: "/x" } },
          ],
        },
      }),
    ];
    expect(parseSubagentTail(lines).running).toBe(true);
  });

  it("flags running=true when the last entry is a user tool_result", () => {
    const lines = [
      JSON.stringify({
        type: "user",
        isSidechain: true,
        message: {
          content: [
            { type: "tool_result", tool_use_id: "abc", content: "ok" },
          ],
        },
      }),
    ];
    expect(parseSubagentTail(lines).running).toBe(true);
  });

  it("flags running=false when the last entry is a text-only assistant turn", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        message: {
          model: "claude-haiku-4-5",
          usage: { input_tokens: 5 },
          content: [{ type: "text", text: "done." }],
        },
      }),
    ];
    expect(parseSubagentTail(lines).running).toBe(false);
  });

  it("ignores <synthetic> model entries", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        message: {
          model: "<synthetic>",
          usage: { input_tokens: 0 },
          content: [],
        },
      }),
    ];
    const got = parseSubagentTail(lines);
    expect(got.model).toBeNull();
    expect(got.ctx).toBeNull();
  });

  it("tolerates malformed lines", () => {
    const lines = [
      "not json",
      JSON.stringify({ type: "assistant", message: { content: "x" } }),
    ];
    const got = parseSubagentTail(lines);
    expect(got.model).toBeNull();
  });
});