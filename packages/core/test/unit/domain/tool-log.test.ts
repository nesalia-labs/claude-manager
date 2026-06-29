import { describe, expect, it } from "vitest";

import { parseToolLog } from "../../../src/domain/tool-log.js";

describe("domain/tool-log — parseToolLog", () => {
  const FALLBACK_MTIME = 1_700_000_000_000;

  it("emits one entry per tool_use, marked pending", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-06-29T10:00:00.000Z",
        message: {
          model: "claude-sonnet-4-5",
          usage: { input_tokens: 5 },
          content: [
            {
              type: "tool_use",
              id: "toolu_abc",
              name: "Read",
              input: { file_path: "/repo/src/foo.ts" },
            },
          ],
        },
      }),
    ].join("\n");
    const entries = parseToolLog(text, 50, FALLBACK_MTIME);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      toolUseId: "toolu_abc",
      tool: "Read",
      target: "Read: foo.ts",
      status: "pending",
    });
  });

  it("transitions pending → done when tool_result matches", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-06-29T10:00:00.000Z",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_a",
              name: "Read",
              input: { file_path: "/x.ts" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-29T10:00:00.500Z",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "toolu_a", content: "ok" },
          ],
        },
      }),
    ].join("\n");
    const entries = parseToolLog(text, 50, FALLBACK_MTIME);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe("done");
    expect(entries[0]?.durationMs).toBe(500);
  });

  it("transitions pending → error when is_error is true", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-06-29T10:00:00.000Z",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_x",
              name: "Bash",
              input: { command: "false" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-29T10:00:01.000Z",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_x",
              content: "exit 1",
              is_error: true,
            },
          ],
        },
      }),
    ].join("\n");
    const entries = parseToolLog(text, 50, FALLBACK_MTIME);
    expect(entries[0]?.status).toBe("error");
    expect(entries[0]?.durationMs).toBe(1000);
  });

  it("skips sidechain entries", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        isSidechain: true,
        timestamp: "2026-06-29T10:00:00.000Z",
        message: {
          content: [
            {
              type: "tool_use",
              id: "sub_x",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
      }),
    ].join("\n");
    expect(parseToolLog(text, 50, FALLBACK_MTIME)).toEqual([]);
  });

  it("returns newest-first, capped at maxEntries", () => {
    const text = Array.from({ length: 5 }, (_, i) =>
      JSON.stringify({
        type: "assistant",
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        message: {
          content: [
            {
              type: "tool_use",
              id: `id_${i}`,
              name: "Read",
              input: { file_path: `/f${i}.ts` },
            },
          ],
        },
      }),
    ).join("\n");
    const entries = parseToolLog(text, 3, FALLBACK_MTIME);
    expect(entries).toHaveLength(3);
    // Newest first: id_4, id_3, id_2
    expect(entries.map((e) => e.toolUseId)).toEqual(["id_4", "id_3", "id_2"]);
  });

  it("ignores tool_result without a matching tool_use", () => {
    const text = [
      JSON.stringify({
        type: "user",
        timestamp: "2026-06-29T10:00:00.000Z",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "unknown", content: "" },
          ],
        },
      }),
    ].join("\n");
    expect(parseToolLog(text, 50, FALLBACK_MTIME)).toEqual([]);
  });

  it("falls back to fallbackMtime when timestamps are missing or invalid", () => {
    const text = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "x",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
      }),
    ].join("\n");
    const entries = parseToolLog(text, 50, FALLBACK_MTIME);
    expect(entries[0]?.atMs).toBe(FALLBACK_MTIME);
  });
});