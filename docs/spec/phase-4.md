# Phase 4 — Agent tree (subagents a session spawned)

## Summary & goal

When a session used multi-agent orchestration, Claude Code stores each subagent's
transcript on disk. This phase surfaces them: a session view gains an **`## agents`**
section that shows the subagents the session spawned as a tree — what type, what they
were told to do, how much they did — and lets you open any subagent's transcript inline.

This answers "that big session fanned out — who did what?" and doubles as a small,
honest demo of agentic AI for the portfolio.

## Verified data facts (this machine, Claude Code v2.1.x)

Under `~/.claude/projects/<encoded>/<session-uuid>/subagents/`:

- **Task-spawned agents** (the `Agent` tool) live at the top level:
  `agent-<hex>.jsonl` + `agent-<hex>.meta.json`.
  - meta: `{ agentType, description, toolUseId }` — `agentType` is the human name
    (`reviewer`, `builder`, `general-purpose`, `Explore`, …), `description` is a
    human label ("Build login feature (Option A)"), `toolUseId` links back to the
    parent turn's Task tool_use.
- **Workflow-spawned agents** live under `subagents/workflows/wf_<id>/`:
  `agent-<hex>.jsonl` + `.meta.json` with `{ agentType: "workflow-subagent",
  spawnDepth }`.
- A subagent transcript's lines are the SAME shape as a normal transcript, EXCEPT
  every line has `isSidechain: true` (they *are* the sidechain). The first line is a
  `user` line = the task/prompt the subagent was given.

Real example on this machine: one `builtin-asset-spac` session spawned **23** Task
subagents (builders + reviewers). Many sessions have zero — the section only appears
when there's something to show.

## Server

- `data/subagents.ts`
  - `AGENT_ID_RE = /^agent-[0-9a-f]+$/` (path-traversal guard).
  - `listSessionAgents(projectPath, sessionId)` → `{ taskAgents, workflows }`:
    - `taskAgents: AgentNode[]` from top-level `agent-*.jsonl`
    - `workflows: { wfId, agents: AgentNode[] }[]` from `workflows/wf_*/`
    - `AgentNode`: `{ agentId, agentType, description, firstPrompt, messageCount,
      toolCount, size, finalText }` — meta read from the `.meta.json`; `firstPrompt`,
      counts, and `finalText` from a tail-window parse of the transcript.
    - Sorted: task agents by mtime asc (spawn order-ish); workflows by wf id.
  - `readSubagentThread(projectPath, sessionId, agentId)` → messages via a
    **sidechain-aware** parse; 404 signalled by returning null when the file is absent.
- `transcripts.ts`: `parseThread(lines, limit, opts?)` gains `opts.includeSidechain`
  (default false — the main thread still skips sidechain chatter). A new
  `firstUserText(lines)` returns the first sidechain user line's text (the task prompt).
- API:
  - `GET /api/session/agents?path=&id=` → `{ taskAgents, workflows }` (id uuid-guarded).
  - `GET /api/subagent?path=&id=&agent=` → `{ thread }` (agent id regex-guarded; 404
    when missing).

## UI

- Session view: below the header/summary, an **`## agents (N)`** section rendered ONLY
  when N>0 (keeps ordinary sessions unchanged). Layout:
  - Task agents as rows: a colored **type chip** (stable colour per agentType),
    the description (fallback: first prompt), and a mono meta line
    `n messages · m tools · size`.
  - Workflow runs grouped under a `▸ workflow wf_… · k agents` header, agents listed
    the same way, indented.
  - Clicking a row toggles an **inline panel** that fetches and renders that subagent's
    transcript with the existing `Message` component (sidechain included). One open at
    a time; a spinner while loading.
- No new route — the panel expands within the session view. Polling untouched.

## Out of scope

Cross-session agent analytics; visualizing the parent→child link by tool-use id
(we show the tree, not the exact call site); editing/re-running agents; deep nesting
beyond one workflow level (spawnDepth is recorded but shown flat in v1).

## Test plan

- **Vitest**: `parseThread` includeSidechain keeps sidechain lines; `firstUserText`;
  `listSessionAgents` finds both task + workflow agents, reads meta (type/description),
  computes counts, sorts; `AGENT_ID_RE` rejects `../` / non-agent ids; empty when no
  `subagents/` dir. Fixtures synthesized (fake agent-*.jsonl + .meta.json).
- **Playwright e2e**: extend the fixture rocket-shop live session with a `subagents/`
  dir — two Task agents (a `builder` + a `reviewer`, with descriptions) and one
  workflow run of two `workflow-subagent`s. Assert: `## agents (4)` shows; type chips
  + descriptions render; counts present; clicking the builder expands its transcript
  (task prompt + an assistant turn + a tool chip); a session without subagents
  (moon-blog) shows no agents section.
- **QA shots**: session view with the agents tree, one agent expanded (desktop +
  mobile).

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` into main → push; tick Phase 4
in CLAUDE.md.
