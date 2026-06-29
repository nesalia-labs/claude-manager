/**
 * `Proc` — the cross-platform shape every process-table source returns.
 * Mirror of cctop's `src/proc/types.ts`.
 */

export interface Proc {
  pid: number;
  ppid: number;
  rss: number; // bytes
  cpuSec: number;
  startSec: number; // unix seconds
  path: string | null;
  name: string;
  uid: number;
}

export interface ProcSource {
  list(): Promise<Proc[]>;
  cwdOf(pid: number): Promise<string | null>;
  close(): Promise<void>;
}
