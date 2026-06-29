import { describe, expect, it } from "vitest";

import { collectOnce } from "../../src/once.js";

import { matchFilter } from "../../src/domain/filter.js";
import type { Instance } from "../../src/types.js";

const makeInstance = (over: Partial<Instance> = {}): Instance => ({
  pid: 1,
  sessionId: null,
  sessionName: null,
  project: null,
  projectEncoded: null,
  branch: null,
  model: null,
  contextTokens: null,
  status: "done",
  uptimeSec: 0,
  lastMs: 0,
  prompt: null,
  processAlive: false,
  transcript: null,
  subagents: [],
  children: [],
  orphanPorts: [],
  ...over,
});

describe("domain/filter — matchFilter (pure)", () => {
  it("returns true for null filter", () => {
    expect(matchFilter(makeInstance(), null)).toBe(true);
  });

  it("matches project substring (case-insensitive)", () => {
    expect(
      matchFilter(makeInstance({ project: "/Users/me/myrepo" }), "MYREPO"),
    ).toBe(true);
  });

  it("matches branch substring", () => {
    expect(matchFilter(makeInstance({ branch: "feat/login" }), "login")).toBe(true);
  });

  it("matches model substring", () => {
    expect(matchFilter(makeInstance({ model: "claude-sonnet-4-5" }), "sonnet")).toBe(true);
  });

  it("matches session id substring", () => {
    expect(matchFilter(makeInstance({ sessionId: "abc-123" }), "ABC")).toBe(true);
  });

  it("matches session name substring", () => {
    expect(matchFilter(makeInstance({ sessionName: "auth-refactor" }), "auth")).toBe(true);
  });

  it("returns false when no field matches", () => {
    expect(matchFilter(makeInstance({ project: "/foo" }), "BAR")).toBe(false);
  });
});

describe("once — collectOnce applies filter", () => {
  it("filters by passing the filter down through the pipeline", async () => {
    // Smoke check that collectOnce accepts the Filter arg without error.
    const snap = await collectOnce(null);
    expect(Array.isArray(snap.instances)).toBe(true);
  });
});
