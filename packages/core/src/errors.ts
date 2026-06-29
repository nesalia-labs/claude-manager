/**
 * Typed errors thrown across `core`'s public boundary.
 *
 * Rules:
 *   - `~/.claude` missing → empty `Instance[]`, never thrown.
 *   - Partial / malformed JSONL → warning event, never thrown.
 *   - Programmer errors (invariant violations) → `CoreError { kind: "internal" }`.
 */

export type CoreErrorKind =
  | "registry-unreadable"
  | "transcript-partial"
  | "proc-unavailable"
  | "internal";

export class CoreError extends Error {
  public readonly kind: CoreErrorKind;

  constructor(
    kind: CoreErrorKind,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CoreError";
    this.kind = kind;
  }
}
