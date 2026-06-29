# User Stories — claude-manager v1

These are the concrete situations claude-manager v1 must support. Each story is sized to fit the project-grouped, subagent-aware, tool-log-rich v1 scope.

## Primary personas

- **Solo dev** — runs Claude Code in multiple terminals at once on a Windows machine, often across different projects. Sometimes forgets which terminal is which.
- **Heavy CC user** — has 3–8 sessions open concurrently, regularly spawns subagents for research and verification. Wants to track what's delegated and what's still pending.
- **Tinkerer** — likes reading raw `~/.claude/` files for fun; wants a nicer lens on the same data.

## Stories

### US1 — Find a session by project

> As a solo dev with sessions open on two different repos,
> I want sessions grouped by project in the TUI,
> so that I can scan "what is happening on each repo" without reading every row.

**Acceptance:**
- Sessions are grouped under a project header showing the decoded project path.
- Each project header is collapsible / expandable.
- Projects are sorted alphabetically by decoded path.

### US2 — Identify a session's state at a glance

> As a heavy CC user,
> I want to see each session's status (`idle` / `running` / `done`),
> so that I can spot stalled or completed work without reading the terminal.

**Acceptance:**
- Each session row shows a status badge.
- The three statuses are visually distinct (color + glyph).
- The status transitions automatically as the underlying process and transcript update.

### US3 — Track subagents spawned by a session

> As a heavy CC user who delegates research to Explore and verification to general-purpose agents,
> I want to see, for a given session, every subagent it has spawned — past and present,
> so that I can see what work has been delegated and what's still in flight.

**Acceptance:**
- The session detail view shows a "Subagents" pane.
- Each subagent row shows type, description, status, model, duration.
- Subagents that have finished are still visible (with status `done`).
- Subagents currently running are visually distinct.

### US4 — Inspect a session's tool activity

> As a solo dev wondering "what is my session actually doing right now?",
> I want to see the chronological stream of tool calls for a focused session,
> so that I can answer questions like "is it still on that Bash command?" or "did it finish the edits?".

**Acceptance:**
- The session detail view shows a "Tool log" pane next to the Subagents pane.
- Each row shows time, tool name, target (file path / command / pattern), status, duration.
- The log is in chronological order, newest entries visible at the bottom.
- The log updates live as the session emits new tool calls.

### US5 — Distinguish tool calls in progress

> As a heavy CC user,
> I want to see which tool call is currently running vs which have completed,
> so that I can tell whether my session is making progress or stuck.

**Acceptance:**
- Tool rows show a status: `pending` (tool_use emitted, no result yet), `done` (completed), `error` (tool_result.is_error === true).
- Pending tool calls are visually distinct (e.g. animated indicator or `…` glyph).
- Errors are visually distinct (e.g. red, or `✗` glyph).
- When a tool_use gets a matching tool_result, its row transitions from `pending` to `done` or `error` within the live update tick.

### US6 — Resume a session from the dashboard

> As a tinkerer,
> I want to copy a `claude --resume <id>` command for any session,
> so that I can paste it into a fresh terminal to continue work.

**Acceptance:**
- Pressing `y` on a focused session row copies the resume command to the clipboard.
- A confirmation toast appears briefly.
- The session detail view also displays the resume command visibly.

### US7 — Watch a new session appear

> As a solo dev,
> I want to start a new Claude Code session in another terminal and see it appear in claude-manager automatically,
> so that I don't have to restart the dashboard.

**Acceptance:**
- Within 5 seconds of a new CC process starting, a new session row appears under the correct project section with status `running`.
- The row updates as the session writes to its transcript.
- If the new session is in a project not yet shown, a new project section appears.

### US8 — Notice when a session ends

> As a heavy CC user,
> I want sessions that have just finished to be visually distinguishable,
> so that I can clean up my terminal tabs without checking each one.

**Acceptance:**
- When a CC process exits, its row transitions to status `done`.
- `done` rows are visually distinct (dimmed, or with a `✓` glyph).
- `done` rows persist for a short time (e.g. 5 minutes) and then disappear automatically.

### US9 — Filter the list

> As a heavy CC user with many concurrent sessions,
> I want to filter by project or session name,
> so that I can focus on one piece of work.

**Acceptance:**
- Pressing `/` opens a filter input.
- Typing filters both project headers and session rows in real time (fuzzy match on project path and session name).
- Projects with no matching sessions are hidden.
- `Esc` clears the filter.
- The status bar shows how many sessions are visible vs total.

### US10 — See model and duration context

> As a solo dev on a budget,
> I want to see which model each session is using and how long it has been running,
> so that I can decide whether to keep an expensive session going.

**Acceptance:**
- Each session row shows model (Opus / Sonnet / Haiku / unknown) and duration.
- Model is inferred from the most recent `assistant.message.model` field in the session JSONL.
- Duration updates live.

## Non-stories (v1)

These are explicitly **not** stories for v1 — they are recorded here so future readers know they were considered and rejected for v1:

- "I want to see token costs per session."
- "I want to stop a session from the dashboard."
- "I want to send a prompt to a session."
- "I want to see the full input/output of a specific tool call."
- "I want to drill into a subagent's own transcript."
- "I want to see this on my Linux work machine too."
- "I want a kanban view of CC's task system."
- "I want to compare two sessions side by side."

Each is a real future feature; see [roadmap.md](./roadmap.md).