# Phase 5 (feature 1) — "session finished" notifications

## Summary & goal

The reason claude-deck exists: the owner runs many sessions in parallel and loses track
of which one is still working. This feature pings you when a **busy** session goes
**idle** — i.e. "that task just finished" — with a desktop notification, so you don't
have to keep staring at the deck.

## Scope & approach

- **Client-side detection.** The dashboard already polls `/api/live` every ~5s. We keep
  the previous poll's per-session status and, when a session flips **busy → idle**, fire
  a browser `Notification`. No server changes — the data is already there.
- This works while the deck tab is open (the intended usage — you keep it on a second
  screen). OS-level push when the tab is closed would need a service worker + SSE and is
  out of scope for v1 (noted below).
- **Opt-in.** A bell toggle in the header. Off by default. Turning it on requests
  `Notification` permission; the choice is remembered in `localStorage`
  (`claudeDeck.notify`). If permission is denied, the toggle shows a blocked state.
- **No spam on load.** The first poll only establishes a baseline — a session that is
  already idle when the page opens never fires. Only an observed busy→idle transition
  fires. A session that disappears (process died) does **not** fire in v1 (we can't tell
  "finished" from "crashed"); only busy→idle does.

## Design / behaviour

- Bell button in the dashboard header, left of the live pill:
  - off: `🔕 notify` (faint)
  - on + granted: `🔔 notify` (cyan)
  - on + denied: `🔕 blocked` (amber, title explains to enable in browser settings)
- On each poll, for every session whose status went busy→idle since the last poll and is
  still present, fire `new Notification("✓ <name> finished", { body: "<project> is now
  idle", tag: sessionId })`. `tag` de-dupes if the same transition is seen twice.
- Poll interval centralized in `src/web/lib/config.ts` `pollMs()` → reads
  `window.__CLAUDE_DECK_POLL_MS__` if set (test seam), else 5000.

## Files

- `src/web/lib/notify.ts` — pure `diffFinished(prev, next)` returning the sessions that
  went busy→idle (prev = `Map<sessionId, status>`), DOM-free and unit-tested; plus a thin
  `fireFinished(sessions)` wrapper that calls `Notification` (not unit-tested).
- `src/web/lib/config.ts` — `pollMs()`.
- `src/web/hooks/useIdleNotifications.ts` — owns the enabled/permission state,
  localStorage, and the prev-status map; exposes `{ enabled, state, toggle, onPoll }`.
- `Dashboard.tsx` — render the bell; call `onPoll(sessions)` after each successful poll.

## Out of scope

Server push / notifications when the tab is closed; per-project mute; sound; notifying on
session start or crash. (Search is feature 2, a separate phase.)

## Test plan

- **Vitest** (`src/web/lib/notify.test.ts`, node env): `diffFinished` returns only
  busy→idle sessions; ignores idle→idle, busy→busy, idle→busy (start), and
  disappeared sessions; empty prev (first load) yields nothing; new busy session on first
  sight yields nothing. (Broaden vitest `include` to `src/**/*.test.ts`.)
- **Playwright e2e** (`e2e/notifications.spec.ts`): stub `window.Notification` via
  `addInitScript` to record constructions + report permission granted; set
  `__CLAUDE_DECK_POLL_MS__` low for a fast second poll. Enable the bell, flip the fixture
  rocket-shop session busy→idle on disk, wait for the next poll, assert one Notification
  with the session name; **restore the fixture to busy** in `finally` so later serial
  specs still see it busy. Also assert: bell persists via localStorage across reload; no
  notification fires on plain load.
- **QA shot**: dashboard header with the bell enabled.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` into main → push.
