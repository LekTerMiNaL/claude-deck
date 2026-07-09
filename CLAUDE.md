# claude-deck — local dashboard for Claude Code sessions (CLAUDE.md)

A local-only web app that gives one place to see and manage every Claude Code session across
projects: what's running right now, what each project was last working on, read any session's
transcript, and copy a `claude --resume` command to continue it. Owner = **LekTerMiNaL** (เล็ก),
speaks Thai — reply in Thai, code/comments/commits in English.

**Why it exists**: the owner runs many services in parallel, each in its own terminal with its own
Claude Code session, and keeps losing track of which terminal is doing what. Also a portfolio
piece for lekterminal.dev and intended to become a **public GitHub repo** (MIT) — keep the code
clean and never commit anything containing the owner's transcript data.

## Status (as of 2026-07-07)
- [x] Concept + 3 mock screens approved by owner (see `docs/mockups/*.html` — open in a browser;
      they ARE the design reference, built to be pixel-honest)
- [x] Phase 1: scaffold + data layer + Dashboard + add-project flow (spec: `docs/spec/phase-1.md`,
      merged 2026-07-08; gate = typecheck + build + 13 unit + 6 e2e, all green)
- [x] Phase 2: Session view + resume + live status polling (spec: `docs/spec/phase-2.md`,
      merged 2026-07-08)
- [x] Phase 3: AI summaries via `claude -p` (haiku, cached in `~/.claude-deck/summaries.json`),
      open-in-Terminal (macOS osascript, feature-detected), cross-project timeline at `/timeline`
      (spec: `docs/spec/phase-3.md`, merged 2026-07-08)
- [x] Phase 4: Agent tree — session view surfaces the subagents a session spawned
      (Task agents with type+description, workflow runs), expandable subagent transcripts
      (spec: `docs/spec/phase-4.md`, merged 2026-07-09)
- [x] Phase 5 (feature 1): "session finished" desktop notifications — the deck fires a
      browser Notification when a busy session goes idle; opt-in bell toggle in the header
      (localStorage + permission), client-side busy→idle detection between polls
      (spec: `docs/spec/phase-5-notifications.md`, merged 2026-07-10)
- [x] Phase 5 (feature 2): cross-project prompt search at `/search` — case-insensitive
      substring over every prompt in history.jsonl (331 KB → no index needed; full-text
      transcript search = v2, needs an inverted index over 400+ MB), match highlight,
      deep links, query in URL (spec: `docs/spec/phase-5-search.md`, merged 2026-07-10)
- [x] Phase 6: usage-limit bars (statusline bridge → `~/.claude-deck/rate-limits.json`,
      owner's statusline configured), `npx github:LekTerMiNaL/claude-deck` bin (npm name
      taken → package is `@lekterminal/claude-deck`, binary stays `claude-deck`; publish
      to npm = owner's call), GitHub Actions CI (badge on README), `/stats` page
      (validated chart palette #8b5cf6/#0891b2/#16a34a/#d97706 on #12152a), remove
      project/root from deck UI (specs: `docs/spec/phase-5-*.md`, `phase-6-*.md`,
      merged 2026-07-10)
- Full gate as of Phase 6: 69 Vitest unit + 41 Playwright e2e, all on synthesized fixtures

## Decisions already made (with the owner)
- **Name**: `claude-deck`. Public GitHub repo (MIT): https://github.com/LekTerMiNaL/claude-deck
  (since 2026-07-08; owner-only write, contributions via fork + PR).
- **Core UX**: the deck starts EMPTY. The user adds projects one by one — no auto-populating
  everything. (Owner was explicit about this.)
- **How projects get added** (all three, owner was explicit that paths come from the user):
  1. pick from a scanned list (projects that already have Claude history in `~/.claude/projects`),
  2. type/paste a single project path,
  3. register a **root folder** (e.g. `~/Documents/AiProject`) — its subfolders show up as
     addable projects, including ones with no Claude history yet.
- **Deck config** lives at `~/.claude-deck/config.json` (projects added, roots registered).
  `~/.claude` is **read-only, always** — never write there.
- **Local-only**: bind `127.0.0.1`, no telemetry, no external calls. This is the security story
  for a public repo whose users point it at their private transcripts.
- **Stack**: TypeScript everywhere. Server = Hono on Node (`@hono/node-server`), serves both the
  API and the built frontend. Frontend = React + Vite + Tailwind v4 (`@tailwindcss/vite`).
  No DB — read the files fresh + light in-memory caching (mtime-keyed). Client polls every ~5s
  for live status (SSE only if polling proves annoying).
- **Run story**: `npm run dev` for hacking; end goal `npx claude-deck` (bin entry) opening
  `http://127.0.0.1:5757`.
- **Design**: Midnight × Terminal — same personal brand as the owner's portfolio
  (`../lekTerMiNaLDev`, live at https://lekterminaldev.lekterminal.workers.dev). Tokens: bg
  `#0a0d1c` · ink `#e8ebf7` · muted `#9aa3c0` · faint `#5b6382` · line `rgba(255,255,255,.09)` ·
  glass `rgba(255,255,255,.045)` · violet `#a78bfa` · cyan `#67e8f9` · busy-green `#4ade80`.
  Fonts: Space Grotesk (display) · Inter (body) · JetBrains Mono (terminal bits). Motifs:
  traffic-light window bars on cards, `##` section markers, `$`/`❯` prompts, gradient
  violet→cyan on CTAs, glows. Copy the exact patterns from the mockups.

## The data (verified on this machine, Claude Code v2.1.x)
| What | Where | Notes |
|---|---|---|
| Transcripts per session | `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl` | encoded-path = abs path with non-alphanumerics → `-` (LOSSY: `gyo-demo` and `gyo/demo` collide). Recover real paths by matching against `history.jsonl` paths + registered roots, not by naive decode. Subdirectories with a session-uuid name hold subagent transcripts — ignore in v1. `memory/` subdir = project memory. |
| Prompt history (all projects) | `~/.claude/history.jsonl` | one JSON/line: `display`, `timestamp` (ms), `project` (REAL path), `sessionId`. Use as the index: real paths, per-session first/last prompt, counts. |
| Live sessions | `~/.claude/sessions/<pid>.json` | `pid`, `sessionId`, `cwd`, `name` (e.g. `vesta-25`), `status` (`busy`/`idle`), `startedAt`, `updatedAt`. Files LINGER after exit — a session is live only if `process.kill(pid, 0)` succeeds. |
| Plans | `~/.claude/plans/*.md` | Phase 3. |
| Transcript line format | in each `.jsonl` | lines with `type: "user"|"assistant"` + `message.role/content`; content = string or array of `{type:"text"|"tool_use"|"tool_result",…}`. Render user text + assistant text + tool_use names as chips; skip tool_result carriers, `progress`, `file-history-snapshot` etc. Files reach several MB — tail-parse the last N entries, never load-all into the UI. |
| Resume | `cd <cwd> && claude --resume <sessionId>` | v1 = copy button; "open Terminal" via AppleScript is Phase 3 (macOS-only, feature-detect). |

## The 3 screens (mockups in docs/mockups/)
1. **Dashboard** (`deck-dashboard.html`) — header (logo, "N sessions running" pill, + Add project);
   `## LIVE NOW` grid: every live session (green pulse = busy, grey = idle, project, pid, uptime,
   last prompt, open ↗) — shows ALL live sessions even if their project isn't in the deck;
   `## DECK` grid: terminal-window cards per added project (name, path, session count, last
   activity, prompt count, latest prompt line, `● n live` badge) + dashed "+ add project" card.
2. **Add-project modal** (`deck-add.html`) — filter box, scanned list sorted by last activity,
   `✓ in deck` marks, `⚠ folder missing — history only` for orphans (owner has a real one:
   `gyoDemo`, renamed to `gyo-demo`). PLUS (not in mock, decided after): a path input row —
   paste a project path or a root folder; roots get remembered and their subfolders listed.
3. **Session view** (`deck-session.html`) — left sidebar: the project's sessions (live dot,
   name, first-prompt snippet); main: header card (status, name, short id, started/size/message
   count, `$ claude --resume <id>` + copy) and the transcript thread (user = violet-tinted
   card with `❯`, assistant = glass card with `✦`, tool chips, timestamps).

## Working style (owner is used to this from vesta / lekTerMiNaLDev)
- Small steps; propose a short plan before coding each phase; surface trade-offs briefly.
- Gate before merge: typecheck (`tsc --noEmit`) + build + lint if configured. Feature branch →
  `merge --no-ff` to main. English commit messages.
- The owner often works from a phone — send screenshots (Playwright is available via
  `../vesta/node_modules/playwright`) when showing UI work.
- Never commit real transcript content, session ids, or the owner's project names in fixtures —
  synthesize fake fixtures for tests/screenshots that will go public.
- **Every feature follows the pipeline** (pattern borrowed from `../builtin-asset-spac`):
  1. **spec** in `docs/spec/<phase-or-feature>.md` (acceptance criteria + test plan) — no code before spec,
  2. **code**,
  3. **Vitest unit tests** for data-layer/lib logic,
  4. **Playwright e2e** in `e2e/` against the built server pointed at a **synthesized** fake
     claude-dir fixture (env: `CLAUDE_DECK_CLAUDE_DIR`, `CLAUDE_DECK_CONFIG_DIR`, `CLAUDE_DECK_FAKE_PIDS`),
  5. **QA screenshots** via `scripts/qa-shots.mjs` for the owner to review (often on a phone).
  Gate = typecheck + build + unit + e2e all green before merge.
