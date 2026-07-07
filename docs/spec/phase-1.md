# Phase 1 — scaffold + data layer + Dashboard + add-project flow

## Summary & goal

Ship a runnable local web app (`npm run dev`, prod at `http://127.0.0.1:5757`) with:
the read-only data layer over `~/.claude`, the Dashboard screen (LIVE NOW + DECK),
and the add-project flow covering all 3 paths (scanned list / paste a project path /
register a root folder). Design must match `docs/mockups/deck-dashboard.html` and
`deck-add.html` pixel-honestly.

## Architecture

Single npm package, TypeScript everywhere.

- **Server** `src/server/` — Hono on `@hono/node-server`, binds `127.0.0.1` only.
  Serves `/api/*` + the built frontend from `dist/web`. No DB; reads files fresh with
  mtime-keyed in-memory caching where it matters (history.jsonl).
- **Web** `src/web/` — React + Vite + Tailwind v4 (`@tailwindcss/vite`). Client polls
  every 5s.
- **Testability / safety**: all filesystem roots are injectable via env:
  - `CLAUDE_DECK_CLAUDE_DIR` (default `~/.claude`) — **read-only, enforced by never
    having a write path against it**
  - `CLAUDE_DECK_CONFIG_DIR` (default `~/.claude-deck`) — the only place we write
  - `CLAUDE_DECK_PORT` (default `5757`)
  - `CLAUDE_DECK_FAKE_PIDS` (tests only) — comma-separated pids treated as alive so
    fixtures can simulate live sessions deterministically.

## Data layer (`src/server/data/`)

| Module | Responsibility |
|---|---|
| `paths.ts` | env-resolved roots; `encodeProjectPath()` (non-alphanumeric → `-`, lossy); `~`-shortening for display |
| `history.ts` | parse `history.jsonl` → per-project aggregate: real path, prompt count, last activity, per-session `{firstPrompt, lastPrompt, promptCount, lastTs}` |
| `sessions.ts` | read `sessions/*.json`; live = `process.kill(pid, 0)` succeeds (or pid in `CLAUDE_DECK_FAKE_PIDS`); stale files are dropped |
| `scan.ts` | list `projects/` dirs; recover real paths by matching encoded forms of known real paths (history + deck config + root subfolders); count sessions from `*.jsonl` files (ignore subagent subdirs + `memory/`); mark `missing` when no real path exists on disk (orphan, e.g. `gyoDemo`) |
| `config.ts` | read/write `<config>/config.json` `{ projects: string[], roots: string[] }`; atomic write (tmp + rename); never touches the claude dir |
| `deck.ts` | join config projects × history × live sessions → deck cards + live cards |

## API

| Route | Returns |
|---|---|
| `GET /api/live` | all live sessions (even if project not in deck): pid, sessionId, name, status busy/idle, cwd, projectName, startedAt, lastPrompt |
| `GET /api/deck` | deck cards: path, name, sessionCount, lastActivity, promptCount, lastPrompt, liveCount |
| `GET /api/scan` | scanned candidates sorted by last activity: name, path, sessionCount, lastTs, live, inDeck, missing |
| `POST /api/deck` `{path}` | add project (validates: exists on disk OR has history); 409 if already in deck |
| `DELETE /api/deck` `{path}` | remove from deck (config only) |
| `GET /api/roots` | registered roots + their subfolder candidates (inDeck/hasHistory flags) |
| `POST /api/roots` `{path}` | register root (must be an existing directory); returns its children |

## UI (match mockups)

- **Dashboard**: header (logo `~/claude-deck` gradient, green `N sessions running` pill
  = count of **busy** sessions, `+ Add project` CTA) · `## LIVE NOW` grid (busy = green
  pulse, idle = grey; project name, pid, uptime, italic last prompt, `open ↗` stub) ·
  `## DECK` grid (traffic-light bar cards, stats row, `❯` latest prompt, `● n live`
  badge) + dashed add-card · footer. Deck starts **empty** — empty state on both grids.
- **Add modal**: traffic-light header "add project — scanned from ~/.claude/projects",
  `$ filter…` box, hint line with count, rows (icon = 2 first chars, name, path, live/
  sessions/ago meta, `+ Add` / `✓ in deck` / `⚠ folder missing — history only`), footer
  note. **Plus** (decided post-mock): a path input row — paste a project path (**Add as
  project**) or a root folder (**Register root**); registered roots list their
  subfolders as addable rows, including ones with no Claude history yet.

## Out of scope (Phase 2/3)

Session view + transcript, resume copy button, live status SSE, AI summaries,
open-terminal action, removing roots via UI.

## Test plan

- **Vitest unit** (`src/server/**/*.test.ts`, fixtures are 100% synthesized — never real
  transcript data): encode/collision + real-path recovery, history aggregation,
  live-session filtering (dead pid dropped, fake pid alive), scan orphan marking,
  config atomic read/write, deck join.
- **Playwright e2e** (`e2e/*.spec.ts`) against the **built** server pointed at a fake
  claude-dir fixture + tmp config dir: empty deck state → scan modal lists fixtures
  sorted, orphan row marked → add from scan → deck card renders stats → paste-path add →
  register root → subfolder (no history) addable → live pill/cards reflect fake pids →
  duplicate add shows `✓ in deck`.
- **QA screenshots** (`scripts/qa-shots.mjs`, pattern from builtin-asset-spac): capture
  dashboard + modal states on the fixture server for owner review on phone.

## Gate (must be green before merge)

`npm run typecheck` (tsc --noEmit) · `npm run build` · `npm test` (Vitest) ·
`npm run test:e2e` (Playwright). Feature branch → `merge --no-ff` into `main`.

## Open questions / assumptions

- Header pill counts **busy** sessions ("running"), the LIVE NOW grid shows busy+idle.
- Deck card title = folder basename (mock shows a prettified "Vesta"; basename keeps it
  honest).
- `open ↗` navigates to `/project/...` route that Phase 2 will implement; Phase 1 stubs
  it (card exists, link disabled with title "Phase 2").
