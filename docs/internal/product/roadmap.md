# Roadmap — claude-manager

The path after v1. Each phase is sized relative to v1 (the sharp tool with project grouping, subagents, and tool log) and assumes v1 is shipping and adopted.

**Reference for post-v1 features:** [cctop (stefanprodan)](https://github.com/stefanprodan/cctop) is a useful north star — features they have that we don't yet (sub-process tree, TCP ports, session history dashboard, usage limits) are obvious v1.x candidates.

## Phasing principle

We ship v1 narrow, learn from real Windows users, and only expand when the data says we should. Every phase below is a candidate; none are committed.

## Phase 2 — Drill into subagent transcripts + process tree

v1 shows subagent metadata (type, model, status, duration). Phase 2 lets the user open a subagent and see **its** tool log — recursively. We also add cctop's process-tree view: sub-processes of each session and the TCP ports they hold.

Candidates:

- Replace the flat subagents pane with a recursive tree.
- Render each subagent's tool log on demand (lazy load — subagent transcripts can be large).
- Reuse the same tool-log renderer as the parent session.
- Add a "sub-processes" pane per session (process tree).
- Show open / orphaned TCP ports per session.

Why second: zero new data sources, just deeper navigation of what we already parse + Windows `netstat` / `Get-NetTCPConnection`. Highest-leverage UX win.

## Phase 3 — Token & cost awareness

Once users trust the live tree, the next most-asked question is "what is this costing me?" DeanLa/cctop, claude-monitor, and claude-dashboard all already ship this.

Candidates:

- Per-session token usage (input / output / cache read / cache write) read from JSONL transcripts.
- Per-subagent token attribution.
- Context window usage percentage (cctop shows this; cheap to add).
- Estimated API cost per session / subagent using a published pricing table.
- Daily / weekly totals in a side panel.

Why third: every competitor already does this. We're a generation behind on purpose; we ship this once the core tree is solid.

## Phase 4 — Session history dashboard (mirrors cctop's `h` view)

Past sessions that are no longer live, but are still useful to browse.

Candidates:

- A "history" tab accessible via `h` (mirrors cctop's UX).
- Per-day token usage chart.
- Recent sessions list (sorted by last activity).
- Breakdowns by model, tool/MCP, and project.

Why fourth: nice-to-have. The live view is the primary value; history is a complement.

## Phase 5 — Usage limits (opt-in, mirrors cctop)

cctop's opt-in weekly 5h/7d rate-limit display, implemented via a CC status-line hook writing to `~/.claude/cctop/usage.json`.

Candidates:

- Add the same opt-in hook.
- Display the current 5h / 7d usage as a top-line in the TUI.
- Skip if not opted in.

Why fifth: same opt-in model as cctop. Trivial to add once we have a config story.

## Phase 6 — Scripting surface (`--once`, `--json`)

cctop's `--once` (single frame) and `--json` (machine-readable snapshot) flags turn the tool into something shell-scriptable. Useful for power users.

Candidates:

- `claude-manager --once` — print one frame, exit.
- `claude-manager --json` — emit the full session state as JSON for piping into `jq`.
- `--watch=N` — configurable refresh interval.

Why sixth: not the primary UX, but cheap and high-value for ops-minded users.

## Phase 7 — Session control (read-write mode, opt-in)

The most-requested feature after observability is control. "Stop this session", "send a follow-up prompt", "branch this session". cctop ships `x` to SIGTERM with confirm — we wait until this phase to ship control.

Important: this is **opt-in**. v1's read-only promise is the trust moat. Phase 7 introduces a config flag (e.g. `claude-manager --enable-control`) that requires explicit acknowledgment.

Candidates:

- Send a prompt to a session via `claude --resume <id> -p "<text>"`.
- Cancel a session (signal the CC process) — mirrors cctop's `x`.
- Branch a session (`/branch`).

Why seventh: high blast radius. Ship it last and ship it carefully.

## Phase 8 — Cross-platform

Once Windows is solid, expand to macOS and Linux. Reuse the architecture, swap the process-listing layer (`tasklist` → `ps` / `lsof`) and the directory-watcher implementation.

Candidates:

- macOS first (largest user base for Claude Code).
- Linux second.
- WSL handling — sessions running under WSL should be visible from a Windows-side claude-manager.

## Phase 9 — Multi-user / team mode

Out of v1's scope but eventually the natural extension:

- A shared backend that aggregates sessions from a team's machines.
- Web view of the same data.
- Per-user / per-project access control.

This becomes a separate product, not a feature flag on v1.

## Things we will probably never do

These are listed so future contributors don't burn cycles proposing them:

- **Replace the Claude Code session picker.** It is good. We are complementary.
- **Run as a Windows service / daemon.** claude-manager is a user-launched tool. Sessions end when the user quits.
- **Provide a hosted SaaS.** Out of scope of this repo's mission. Phase 6 multi-user is a self-hostable backend, not a hosted product.
- **AI-generated insights** ("your session is likely to fail because..."). Not our lane.
- **A web UI.** OpenTUI is the stack. A web frontend is a different product.
- **Replace the in-terminal CC UX.** We surface what's happening; we don't drive it.

## Decision gates between phases

Each phase starts only when:

1. The previous phase is shipping and has real users (not just the maintainer).
2. At least 3 independent users have asked for the next phase's core feature.
3. We can describe the next phase in one sentence without hedging.

If any of these is false, we stay where we are and improve what we have.