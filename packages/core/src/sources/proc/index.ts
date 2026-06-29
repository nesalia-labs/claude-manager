/**
 * Public `createProcSource` for the platform. Currently Windows-only;
 * v1.x will add macOS / Linux per the architecture plan.
 */

import { createWindowsProcSource } from "./windows.js";

export function createProcSource(): ReturnType<typeof createWindowsProcSource> {
  // Future: branch on process.platform.
  return createWindowsProcSource();
}

export type { ProcSource, Proc } from "./types.js";
export type { WindowsProcOptions } from "./windows.js";
