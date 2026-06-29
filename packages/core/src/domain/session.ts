/**
 * Pure parser for the per-PID session registry files. Read-only.
 */

/** Shape of a single `<pid>.json` entry. */
export interface Session {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  version?: string;
  kind?: string;
  status?: string;
  updatedAt?: number;
  name?: string;
}

const FILENAME_RE = /^(\d+)\.json$/;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return Number.isFinite(value) ? (value as number) : undefined;
}

/** Validate a parsed JSON value as a `Session`. Returns null on any failure. */
export function parseSession(raw: unknown, file: string): Session | null {
  const match = FILENAME_RE.exec(file);
  if (!match) return null;
  const filePid = Number(match[1]);

  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as Record<string, unknown>)["pid"] !== filePid ||
    typeof (raw as Record<string, unknown>)["sessionId"] !== "string" ||
    ((raw as Record<string, unknown>)["sessionId"] as string).length === 0 ||
    typeof (raw as Record<string, unknown>)["cwd"] !== "string" ||
    ((raw as Record<string, unknown>)["cwd"] as string).length === 0 ||
    !Number.isFinite((raw as Record<string, unknown>)["startedAt"])
  ) {
    return null;
  }

  const r = raw as Record<string, unknown>;
  return {
    pid: filePid,
    sessionId: r["sessionId"] as string,
    cwd: r["cwd"] as string,
    startedAt: r["startedAt"] as number,
    version: optionalString(r["version"]),
    kind: optionalString(r["kind"]),
    status: optionalString(r["status"]),
    updatedAt: optionalNumber(r["updatedAt"]),
    name: optionalString(r["name"]),
  };
}
