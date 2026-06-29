/**
 * Pure filter matching — substring across project / branch / model / session id / name.
 */

import type { Filter, Instance } from "../types.js";

export function matchFilter(instance: Instance, filter: Filter): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return [
    instance.project,
    instance.branch,
    instance.model,
    instance.sessionId,
    instance.sessionName,
  ]
    .filter((s): s is string => Boolean(s))
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
