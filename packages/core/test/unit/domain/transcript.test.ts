import { describe, expect, it } from "vitest";

import { detailsAreComplete, noteEntry } from "../../../src/domain/transcript.js";

describe("domain/transcript — noteEntry", () => {
  it("captures the git branch from the first entry that carries one", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, { type: "user", gitBranch: "main", message: { content: "hi" } });
    expect(d.branch).toBe("main");
    noteEntry(d, { type: "user", gitBranch: "feature/x", message: { content: "x" } });
    expect(d.branch).toBe("main");
  });

  it("captures the most recent real assistant model and context tokens", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "assistant",
      message: {
        model: "claude-sonnet-4-5",
        usage: {
          input_tokens: 50,
          cache_read_input_tokens: 200,
          cache_creation_input_tokens: 75,
        },
        content: [],
      },
    });
    expect(d.model).toBe("claude-sonnet-4-5");
    expect(d.ctx).toBe(325);
  });

  it("ignores synthetic model entries", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "assistant",
      message: { model: "<synthetic>", usage: { input_tokens: 0 }, content: [] },
    });
    expect(d.model).toBeUndefined();
  });

  it("ignores sidechain assistant turns", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "assistant",
      isSidechain: true,
      message: { model: "claude-haiku", usage: { input_tokens: 5 }, content: [] },
    });
    expect(d.model).toBeUndefined();
  });

  it("captures the prompt from user (string content)", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, { type: "user", message: { content: "  hello\n\nworld  " } });
    expect(d.prompt).toBe("hello world");
  });

  it("captures the prompt from user (content-array text block)", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "user",
      message: { content: [{ type: "text", text: "Read the README please" }] },
    });
    expect(d.prompt).toBe("Read the README please");
  });

  it("unwraps slash-command wrappers", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "user",
      message: {
        content:
          "<command-name>review</command-name><command-args>src/foo.ts</command-args>",
      },
    });
    expect(d.prompt).toBe("review src/foo.ts");
  });

  it("skips harness wrappers like <local-command-stdout>", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "user",
      message: { content: "<local-command-stdout>ok</local-command-stdout>" },
    });
    expect(d.prompt).toBeUndefined();
  });

  it("skips isMeta user entries", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, { type: "user", isMeta: true, message: { content: "hi" } });
    expect(d.prompt).toBeUndefined();
  });

  it("parses timestamp for promptAt", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "user",
      timestamp: "2026-06-29T10:00:00.000Z",
      message: { content: "hi" },
    });
    expect(d.prompt).toBe("hi");
    expect(d.promptAt).toBe(Date.parse("2026-06-29T10:00:00.000Z"));
  });

  it("leaves promptAt undefined for invalid timestamps", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "user",
      timestamp: "not-a-date",
      message: { content: "hi" },
    });
    expect(d.prompt).toBe("hi");
    expect(d.promptAt).toBeUndefined();
  });

  it("caps prompt at 2048 chars", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, { type: "user", message: { content: "x".repeat(5000) } });
    expect(d.prompt?.length).toBe(2048);
  });

  it("concatenates two adjacent text blocks in reverse walk order", () => {
    // Regression: the previous predicate `t.length > buf.length ? t : ...`
    // dropped the accumulated `buf` whenever the current `t` was shorter
    // than the accumulated prose, so the *last* (shorter) text block
    // would survive while the earlier (longer) one was silently dropped.
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "assistant",
      message: {
        model: "claude-sonnet-4-5",
        usage: { input_tokens: 1 },
        content: [
          { type: "text", text: "first message longer than the trailing one" },
          { type: "text", text: "tail" },
        ],
      },
    });
    expect(d.lastMessage).toBe(
      "first message longer than the trailing one tail",
    );
  });

  it("concatenates two adjacent thinking blocks in reverse walk order", () => {
    const d: Parameters<typeof noteEntry>[0] = {};
    noteEntry(d, {
      type: "assistant",
      message: {
        model: "claude-sonnet-4-5",
        usage: { input_tokens: 1 },
        content: [
          { type: "thinking", thinking: "first thought longer than the trailing one" },
          { type: "thinking", thinking: "tail" },
        ],
      },
    });
    expect(d.lastThinking).toBe(
      "first thought longer than the trailing one\ntail",
    );
  });
});

describe("domain/transcript — detailsAreComplete", () => {
  it("returns false when anything is missing", () => {
    expect(
      detailsAreComplete({}),
    ).toBe(false);
    expect(
      detailsAreComplete({ model: "x" }),
    ).toBe(false);
    expect(
      detailsAreComplete({ model: "x", prompt: "hi" }),
    ).toBe(false);
  });

  it("returns true when all three are present", () => {
    expect(detailsAreComplete({ model: "x", prompt: "hi", branch: "main" })).toBe(true);
  });
});
