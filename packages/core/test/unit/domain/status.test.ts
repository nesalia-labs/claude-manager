import { describe, expect, it } from "vitest";

import { deriveStatus } from "../../../src/domain/status.js";
import type { DeriveStatusInput } from "../../../src/domain/status.js";

const base: DeriveStatusInput = {
  processAlive: true,
  lastMs: 0,
  nowMs: 10_000,
};

describe("domain/status — deriveStatus", () => {
  it("returns 'done' when the process is gone", () => {
    expect(deriveStatus({ ...base, processAlive: false, nowMs: 100 })).toBe("done");
  });

  it("returns 'running' for recent activity", () => {
    expect(deriveStatus({ ...base, nowMs: 6_000, lastMs: 5_000 })).toBe("running");
  });

  it("returns 'idle' between runningMs and idleMs", () => {
    expect(deriveStatus({ ...base, nowMs: 30_000, lastMs: 5_000 })).toBe("idle");
  });

  it("returns 'done' once idleMs has elapsed", () => {
    expect(deriveStatus({ ...base, nowMs: 90_000, lastMs: 0 })).toBe("done");
  });

  it("tolerates clock skew (negative age)", () => {
    expect(deriveStatus({ ...base, nowMs: 100, lastMs: 200 })).toBe("running");
  });

  it("respects custom thresholds", () => {
    expect(
      deriveStatus({
        ...base,
        nowMs: 70_000,
        lastMs: 0,
        thresholds: { runningMs: 1_000, idleMs: 30_000 },
      }),
    ).toBe("done");
  });
});
