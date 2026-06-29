/**
 * `ClockSource` — replaces every `Date.now()` read in domain code.
 * Tests inject a fixed clock; production uses the system clock.
 */

export interface ClockSource {
  now(): number;
}

export function createSystemClockSource(): ClockSource {
  return { now: () => Date.now() };
}

/** A clock pinned to a fixed value, for testing. */
export function createFixedClockSource(epochMs: number): ClockSource {
  return { now: () => epochMs };
}
