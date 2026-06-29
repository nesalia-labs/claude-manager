/**
 * Pure helpers over assistant message content blocks. No I/O.
 *
 * Mirrors cctop's `src/collect/entry.ts` `describeAssistant` and
 * `contextTokens`.
 */

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "NotebookEdit"]);

/** Sum of fresh input plus both cache buckets = the size of a turn's context. */
export function contextTokens(usage: {
  input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
} | undefined): number {
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0)
  );
}

/**
 * What a turn did: the most recent tool call (tool + key argument), or
 * failing that a snippet of the latest text. Returns null if neither is
 * available.
 */
export function describeAssistant(message: unknown): string | null {
  const blocks = (message as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(blocks)) return null;

  const tool = [...blocks].reverse().find(
    (b): b is { type: string; name?: string; input?: Record<string, unknown> } =>
      typeof b === "object" &&
      b !== null &&
      (b as { type?: unknown }).type === "tool_use",
  );
  if (tool) {
    const inp = tool.input ?? {};
    const arg = String(
      inp["command"] ??
        inp["pattern"] ??
        inp["query"] ??
        inp["url"] ??
        inp["file_path"] ??
        inp["path"] ??
        inp["description"] ??
        inp["subagent_type"] ??
        "",
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const toolName = tool.name ?? "";
    if (FILE_TOOLS.has(toolName) && arg.includes("/")) {
      const last = arg.split("/").pop();
      return last ? `${toolName}: ${last}` : toolName;
    }
    return arg ? `${toolName}: ${arg}` : toolName;
  }

  const text = [...blocks].reverse().find(
    (b): b is { type: string; text?: string } =>
      typeof b === "object" &&
      b !== null &&
      (b as { type?: unknown }).type === "text",
  )?.text;
  return text ? text.replace(/\s+/g, " ").trim() : null;
}
