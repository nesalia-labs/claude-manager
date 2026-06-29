import { describe, expect, it } from "vitest";

import { parseSession } from "../../../src/domain/session.js";

describe("domain/session — parseSession", () => {
  it("accepts a well-formed entry", () => {
    const raw = {
      pid: 1234,
      sessionId: "abc-def",
      cwd: "C:/Users/me/code/myapp",
      startedAt: 1719700000000,
      version: "2.1.176",
      kind: null,
      status: "busy",
      updatedAt: 1719700005000,
      name: "auth-refactor",
    };
    const got = parseSession(raw, "1234.json");
    expect(got).toEqual({
      pid: 1234,
      sessionId: "abc-def",
      cwd: "C:/Users/me/code/myapp",
      startedAt: 1719700000000,
      version: "2.1.176",
      kind: undefined,
      status: "busy",
      updatedAt: 1719700005000,
      name: "auth-refactor",
    });
  });

  it("rejects when the filename is not <pid>.json", () => {
    expect(parseSession({ pid: 1234 }, "abc.json")).toBeNull();
  });

  it("rejects when pid does not match the filename", () => {
    expect(parseSession({ pid: 1234 }, "9999.json")).toBeNull();
  });

  it("rejects missing sessionId / cwd / startedAt", () => {
    expect(
      parseSession({ pid: 1, sessionId: "", cwd: "/x", startedAt: 1 }, "1.json"),
    ).toBeNull();
    expect(
      parseSession({ pid: 1, sessionId: "abc", cwd: "", startedAt: 1 }, "1.json"),
    ).toBeNull();
    expect(
      parseSession({ pid: 1, sessionId: "abc", cwd: "/x", startedAt: NaN }, "1.json"),
    ).toBeNull();
  });

  it("coerces optional fields to undefined when wrong-typed", () => {
    const got = parseSession(
      {
        pid: 1,
        sessionId: "abc",
        cwd: "/x",
        startedAt: 1,
        version: 42,
        kind: { foo: "bar" },
        status: true,
        updatedAt: "yesterday",
        name: ["not", "a", "string"],
      },
      "1.json",
    );
    expect(got?.version).toBeUndefined();
    expect(got?.kind).toBeUndefined();
    expect(got?.status).toBeUndefined();
    expect(got?.updatedAt).toBeUndefined();
    expect(got?.name).toBeUndefined();
  });
});
