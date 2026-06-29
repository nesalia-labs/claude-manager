# Competitor Landscape

A survey of existing tools in the Claude Code monitoring / dashboard space, and what we learn from each. Researched on 2026-06-29 via `fresh search` and direct repo / docs inspection.

**Reference implementation:** [`cctop` (stefanprodan)](https://github.com/stefanprodan/cctop) — TypeScript + Bun, top-style monitor, sub-agent tree, process tree. macOS/Linux only. **This is the closest analog to what we are building.** Read [Reference: cctop](#reference-cctop) first.

This document is not an exhaustive list. It is the set worth knowing before building v1.

## TL;DR differentiation matrix

| Tool | Stack | OS | Project grouping | Subagent view | Tool log | "Top-style" list | Our edge |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [**cctop (stefanprodan)**](https://github.com/stefanprodan/cctop) | TS + Bun, zero deps | macOS, Linux | Flat (filter by project) | **Yes** (with latest turn) | **Yes** (sub-processes, ports) | **Yes** (default UX) | Windows + project grouping as the primary layout |
| [**cctop (DeanLa)**](https://github.com/DeanLa/cctop) | Python + Textual | macOS, Linux | Column only | Count column | Yes (Tools / Files / Errors cols) | **Yes** (rich columns) | Windows + Bun/`bunx` |
| [cctop.app](https://cctop.app/) | Native macOS app | macOS 13+ | Yes (menubar) | No | No | Menubar cards | Cross-platform terminal, free |
| [claude-dashboard](https://github.com/looselyorganized/claude-dashboard) | Python + Textual/Rich | macOS only | No (flat list) | No | Partial (event stream) | Flat list | Windows-first + project grouping + subagents |
| [claude-monitor](https://github.com/fakirAyoub/claude-monitor) | Rust + ratatui | macOS, Linux | Partial (per-project ranking) | **Yes** (tree view) | Partial (session detail) | Multi-view | Windows-first, sharper scope |
| [ccmonitor](https://github.com/MartinWickman/ccmonitor) | Go | Win, Linux, macOS | **Yes** (grouped by project) | No | No | Project list | Subagent + tool log depth |

---

## Reference: cctop

Two projects share the `cctop` name. We treat **stefanprodan/cctop** as our reference implementation — same stack (Bun + TypeScript), same domain, same architecture instincts.

### stefanprodan/cctop — Bun top-style monitor

- **Repo:** https://github.com/stefanprodan/cctop — 97⭐, Apache 2.0, v0.4.0 (June 2026)
- **Stack:** TypeScript + Bun. Single program. **Zero npm dependencies.** Uses only Bun runtime + OS built-ins.
- **Distribution:** Homebrew (macOS/Linux) + `bun install -g` from GitHub.
- **Positioning:** "Live top-style monitor for Claude Code sessions."

**Feature checklist (we learn from every row):**

| Feature | cctop | Our v1 plan |
| --- | --- | --- |
| All sessions at a glance in one table | ✅ | ✅ (project-grouped variant) |
| Process stats (PID, memory, CPU, uptime) | ✅ | Partial — PID + CPU/memory in detail, not in main row |
| Busy / idle state | ✅ (`busy` / `idle`) | ✅ (`running` / `idle` / `done`) |
| Context size (% remaining) | ✅ | ❌ (post-v1) |
| Model column | ✅ | ✅ |
| Host app (terminal vs IDE) | ✅ | ❌ (post-v1) |
| Project grouping | ❌ (filter-only) | **✅ (primary layout)** |
| Git branch | ✅ | ✅ |
| Last prompt | ✅ | ✅ |
| **Sub-agent tree** with latest turn | ✅ | ✅ (metadata only in v1, drill in v2) |
| **Sub-processes** of each session | ✅ (process tree) | ❌ (post-v1) |
| **Open and orphaned TCP ports** per session | ✅ | ❌ (post-v1) |
| Live TUI navigation | ✅ | ✅ |
| Per-session detail view | ✅ | ✅ |
| Filter and sort on the fly | ✅ | ✅ (filter) |
| `--once` flag (single frame, machine-readable) | ✅ (`--once`, `--json`) | ❌ (post-v1) |
| Weekly usage limits (5h/7d) | ✅ (opt-in via status-line hook) | ❌ (post-v1) |
| Quit a session with SIGTERM | ✅ (`x`, with confirm) | ❌ — **strictly read-only** |
| Reclaim orphan ports | ✅ (`f`) | ❌ |
| Session history dashboard | ✅ (`h` — token chart, recent sessions, breakdowns) | ❌ (post-v1) |
| Read-only on `~/.claude` + process table | ✅ ("spawns no processes") | ✅ (hard promise) |
| Zero npm dependencies | ✅ | ❌ (we use `@opentui/core`) |
| **Windows** | ❌ | **✅** |

**What we adopt wholesale:**
- "Top-style" name and mental model.
- Sub-agent + process tree as core features.
- Filter-by-string on `project, host, branch, model, session id`.
- `--once` and `--json` for scripting (post-v1 for us).
- Detailed keyboard model: `j`/`k` navigation, `Enter` to open detail, `Esc` back, `/` filter, `?` help, `q` quit.

**Where we deliberately differ:**
- **Primary layout is project-grouped, not a flat top-style table.** cctop's flat table is great when you have a handful of sessions. We assume Windows power-users with sessions scattered across multiple repos — grouping is the primary nav.
- **Status taxonomy:** cctop uses `busy` / `idle`. We use `running` / `idle` / `done` (three states, including a terminal state for sessions whose process has exited). Slightly more state but the `done` state lets us auto-clean completed sessions from the list.
- **No `x` (SIGTERM) in v1.** cctop's `x` to quit a session is convenient but compromises the read-only promise. We keep v1 strictly read-only and punt interactive control to a much later roadmap phase.
- **No port inspection in v1.** TCP port tracking is great but it pulls us into Windows `netstat.exe` / `Get-NetTCPConnection` territory and adds complexity. Post-v1.
- **OpenTUI, not zero-deps.** cctop's "zero npm dependencies" is admirable but the cost is a hand-rolled TUI renderer. We're willing to pay the `@opentui/core` dependency for the ergonomics and the React/Solid bindings.

### DeanLa/cctop — Python htop-style

- **Repo:** https://github.com/DeanLa/cctop — 69⭐, MIT
- **Stack:** Python + Textual. Installs via `curl | bash` + `uv` + `jq`.
- **Distribution:** Single shell script installer; runs as `cctop`.

**Feature highlights:**
- **Very granular status taxonomy** (16 labels): `idle`, `awaiting plan`, `needs input`, `awaiting permission`, `thinking`, `planning`, `editing`, `running cmd`, `searching`, `reading`, `searching web`, `subagent`, `reviewing`, `researching`, `mcp:server`, `error:type`, `stale`.
- **Rich columns:** Name, Project, Branch, Status, Model, Ctx%, Tokens, Tools, Files, Agents, Errors, Turns, StopRsn, Duration, Started, Activity.
- **Plugin-based tracking** — installs a CC plugin into `~/.claude/plugins/cache/cctop/`. Sessions started before install are not tracked.
- **macOS/Linux only.**

**What we learn:**
- Granular status labels are useful (e.g. `thinking`, `awaiting plan`, `awaiting permission`). v1 uses 3 labels; a future v1.x could adopt DeanLa's 16-label taxonomy if users ask for it.
- Column-rich layout is a power-user win. We do not match this in v1 (we group by project) but a "columns view" is a post-v1 toggle.
- **We reject the plugin model.** DeanLa requires a CC plugin and the `jq` tool to be installed. We won't modify `~/.claude/`.

### cctop.app — macOS menubar app

- **Site:** https://cctop.app/
- **Platform:** macOS 13+ only. Distributed as a signed `.app` via Homebrew cask or DMG.
- **Pricing:** Paid (developer license).
- **Scope:** Menubar panel, draggable, themes (Claude / Tokyo Night / Gruvbox / Nord), light/dark.

**Feature highlights:**
- **Multi-tool support:** Claude Code, Codex CLI, opencode, pi (one menubar for all your AI coding sessions).
- **Smart jumping:** targets the exact window/tab/pane of the right tool. iTerm2, cmux, Kitty, Ghostty, Codex Desktop, Zellij, tmux, VS Code, Cursor, Windsurf, Zed.
- **Global hotkey** to overlay numbered badges on session cards; press number to jump.
- **Themes** and macOS-native polish.

**What we learn:**
- The cross-tool framing ("every AI coding session, one view") is a strong differentiator. **Post-v2 candidate for us.**
- "Jump to the right pane" is a major UX win. **Post-v1 candidate** for us on Windows Terminal / WSL.
- Native macOS app = paid. We're free and open source.

---

## Other competitors (deep dives)

### claude-dashboard (mhofwell)

**What it does.** Real-time terminal dashboard built with Textual/Rich. Three tabs: Live (event stream + token usage + running instances), Stats (sessions/messages/tokens tables), Instances (full process table). Reads `~/.claude/events.log`, `~/.claude/token-stats`, `~/.claude/model-stats`, `~/.claude/stats-cache.json`.

**Strengths.**
- Very rich feature set — covers events, tokens, models, instances in one tool.
- Supabase exporter for cloud sync.

**Weaknesses for our purposes.**
- macOS only ("uses `ps` and `lsof` for process detection").
- Python packaging on Windows is a non-starter for `bunx`-style distribution.
- Reads `events.log` — a stream that doesn't exist in all CC versions or paths.
- **No project grouping, no subagent view, no tool log view.**

**What we learn.**
- `events.log` is a useful data source when it exists. Post-v1 candidate, not v1.
- The 3-tab model is overkill for v1.

### claude-monitor (fakirAyoub)

**What it does.** Real-time TUI in Rust + ratatui. Seven views: Dashboard, Session Detail, Agent Tree, Analytics, Task Board, History, Codex. Reads `~/.claude/projects/*/` JSONL transcripts, `~/.claude/stats-cache.json`, `~/.claude/history.jsonl`, `~/.claude/tasks/`, `~/.codex/sessions/`.

**Strengths.**
- Comprehensive feature set.
- **Sub-agent tree is genuinely useful** — Plan, Explore, GeneralPurpose agents rendered with per-agent token stats.
- Strong architecture doc.

**Weaknesses for our purposes.**
- macOS/Linux only.
- Rust distribution story is "install via brew or build from source", not `bunx`.
- 7 views is a lot of surface area for an MVP.

**What we learn.**
- **Sub-agent tree is a strong v1 feature** — we adopt the same data model.
- Reading JSONL transcripts directly is the right primary data source.
- We deliberately stop at "metadata only" for subagents in v1 to keep scope sharp.

### ccmonitor (MartinWickman)

**What it does.** CLI dashboard in Go. Shows progress of all running CC sessions, **grouped by project (directory)**. Click to jump to tmux pane or Windows Terminal tab. Displays working / waiting / idle status and the latest prompt.

**Strengths.**
- **Cross-platform** including Windows.
- Click-to-switch to Windows Terminal tab.
- **Project grouping is built in.**

**Weaknesses for our purposes.**
- Uses CC hooks, which requires installing a plugin.
- Go binary distribution = no `bunx`.
- **No subagent view, no tool log view.**

**What we learn.**
- **This is our closest cross-platform analog** (Windows + project grouping).
- Status model (`working` / `waiting` / `idle` / `ended`) is right; we simplify to `running` / `idle` / `done`.
- **Their decision to use hooks is something we explicitly reject.**

---

## Our position

claude-manager is the **Windows-first, read-only, npm-distributed, project-grouped, subagent-aware, tool-log-rich** sharp tool in a field where:

- **cctop (stefanprodan)** is the closest analog in stack and scope — same Bun+TS, same "top-style" monitor, same sub-agent awareness — but ships for macOS/Linux only. **We are the Windows port of this idea, sharpened on read-only and project grouping.**
- Most other tools are macOS/Linux first.
- Most tools are broad multi-view suites.
- Most tools are distributed as binaries or source builds.
- Most tools require some level of CC modification (hooks, plugins).
- Almost no tool surfaces subagents or tool activity at the level we plan for v1.

## Strategy for v1 launch

We do **not** compete on features in v1. We compete on:

1. **Windows.** cctop, claude-monitor, claude-dashboard, DeanLa/cctop, cctop.app — every reference is macOS/Linux. We are the Windows-native answer.
2. **Distribution friction.** `bunx claude-manager`, no install steps, no plugin registration. cctop uses brew; we use bunx. Same Bun ecosystem, lower friction.
3. **Strict read-only.** Even cctop ships a `x` key to SIGTERM sessions. We don't. For users who want observability without blast radius, we are the safe choice.
4. **Project grouping as the primary layout.** cctop groups by filter; we group by structure. Different UX assumption.

If a Windows dev wants token analytics, task boards, or a Codex tab — we point them at claude-monitor (macOS/Linux) or DeanLa/cctop (macOS/Linux). When they come back asking for those features on Windows, that's our roadmap.