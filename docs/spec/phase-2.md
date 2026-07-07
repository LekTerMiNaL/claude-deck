# Phase 2 — Session view + resume + per-project sessions

## Summary & goal

Clicking a deck card or a LIVE NOW card's `open ↗` opens the **Session view**
(`docs/mockups/deck-session.html`): left sidebar lists the project's sessions, main pane
shows a header card (status, name, short id, started/size/message count, `$ claude
--resume <id>` + **copy**) and the transcript thread. Live status keeps polling.

## Verified data facts (this machine, Claude Code v2.1.x)

- Transcript files reach **132 MB** → the server must NEVER read a whole file for the
  thread; tail-read a fixed byte window and drop the first partial line.
- Message lines: `{type: "user"|"assistant", timestamp: ISO string, message: {role,
  content}}`; content = string or array of `{type: "text"|"tool_use"|"tool_result", …}`
  (`tool_use` has `name`, its `input` is not rendered in v1).
- Skip: any line whose type isn't user/assistant (`file-history-snapshot`, `ai-title`,
  `last-prompt`, `mode`, `permission-mode`, `bridge-session`, `attachment`, `system`,
  `queue-operation`, `progress`, `summary`…), `isSidechain: true` lines (subagent
  chatter), `isMeta: true` lines, and user lines whose content is only `tool_result`
  blocks (carriers).
- `{type: "ai-title", aiTitle}` lines give a human session title. Naming priority for a
  session: live session `name` (sessions/*.json) → last `aiTitle` found in the tail
  window → first history prompt (trimmed) → short id.

## Server

- `data/transcripts.ts`
  - `tailReadJsonl(file, maxBytes)` — read the last `maxBytes` (default 512 KB), drop
    the partial first line; also return file `size` and line-parse stats.
  - `parseThread(lines, limit)` — last `limit` (default 80) renderable messages:
    `{role: "user"|"assistant", text, tools: string[], ts}`.
  - `readSessionMeta(file)` — size, mtime; `aiTitle` from the tail window.
- `data/project-sessions.ts` — list a project's sessions: transcript files (uuid-named,
  root level only) × history (first/last prompt, counts) × live sessions. Sorted by
  last activity desc.
- API:
  - `GET /api/project?path=…` → `{project, sessions[]}` — session: id, title, firstPrompt,
    lastTs, promptCount, size, live: null | {pid, status, name}
  - `GET /api/session?path=…&id=…` → meta (title, started, size, messageCount≈parsed
    stats, resumeCmd) + thread (last N messages). `404` if the transcript doesn't exist.
  - Path traversal guard: `id` must match the uuid regex.

## UI

- Tiny history-API router (no dep): `/` dashboard, `/project/<b64url(path)>` session
  view (optional `?s=<sessionId>`); server already falls back to index.html.
- Session view per mock: breadcrumb `deck / <project> / session <name>`; sidebar `##
  SESSIONS · <project>` (live dot, title, first-prompt snippet, active state); header
  card (status dot, title, `<shortid> · started … · size · n messages`, `$ claude
  --resume <id>` + copy button → clipboard + "copied ✓" feedback); thread: user = violet
  `❯` cards, assistant = glass `✦` cards, tool chips, timestamps. Long threads note
  "showing last N of ~M messages".
- Dashboard wiring: deck card click + live card `open ↗` → session view (live card links
  with `?s=` preselect).

## Out of scope

Phase 3 items (summaries, open terminal, timeline); SSE; rendering tool inputs/outputs;
subagent transcripts.

## Test plan

- **Vitest**: tail window drops partial first line & respects byte cap; parser renders
  string + array content, collects tool_use names, skips tool_result carriers /
  sidechain / meta / non-message types; ai-title extraction; session naming priority;
  project-sessions join/sort; uuid guard rejects `../` ids.
- **Playwright e2e** (fixtures extended with realistic fake transcripts, incl. one with
  a tool_result carrier + ai-title + a non-message noise line): dashboard → deck card →
  session view; sidebar lists sessions sorted, live dot on the live one; picking the
  other session switches thread; header shows resume cmd; copy button writes clipboard
  (granted permission) and flips to "copied ✓"; live card `open ↗` deep-links with
  session preselected; unknown project path shows a friendly empty view.
- **QA shots**: session view desktop + mobile added to `scripts/qa-shots.mjs`.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` into main.
