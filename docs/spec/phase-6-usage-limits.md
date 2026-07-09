# Phase 6 (feature) — session / weekly usage limits on the dashboard

## Summary & goal

Show Claude's rate-limit usage (5-hour session window + weekly window) as small
progress bars in the dashboard header, so the owner sees "how much runway is left"
without running `/usage` in a terminal.

## How the data gets to us (verified on this machine)

- Nothing under `~/.claude` persists rate limits (checked sessions/*.json,
  stats-cache.json, daemon files, cache/).
- Claude Code DOES feed statusline commands a JSON payload on stdin that includes a
  `rate_limits` field (5-hour and 7-day windows with `used_percentage` and
  `resets_at` — per the official changelog).
- So: claude-deck ships a **statusline bridge** — a tiny script the user sets as their
  Claude Code `statusLine` command. On every statusline refresh it:
  1. writes `{updatedAt, model, rate_limits}` atomically to
     `<CLAUDE_DECK_CONFIG_DIR>/rate-limits.json` (OUR dir — `~/.claude` stays
     read-only),
  2. prints a compact one-line statusline (`<model> · 5h 34% · wk 12%`) so the user
     gets a useful terminal statusline out of the deal.
- Data freshness: updates continuously while any Claude session is active; goes stale
  when nothing runs (which is fine — limits only move when you're using Claude). The
  UI shows "as of N min ago" when stale.

## Files / pieces

- `scripts/statusline-bridge.mjs` — stdin JSON → config-dir file + one-line output.
  Defensive: malformed stdin still prints something and exits 0 (a broken statusline
  must never break the user's TUI). No deps, plain node.
- `src/server/data/usage.ts`:
  - `normalizeRateLimits(raw)` → ordered `UsageWindow[]`
    `{key, label ("5h" | "week" | raw key), usedPercentage (0-100 clamped), resetsAt}`.
    Window keys are matched loosely (`five`/`5` → 5h, `seven`/`7`/`week` → week,
    unknown keys pass through) so shape drift in Claude Code doesn't break us.
  - `readUsage()` → `{configured, updatedAt, model, windows, stale}`;
    `configured=false` when the file is missing/unreadable; `stale` when
    `updatedAt` is older than 10 min.
- API `GET /api/usage` → the readUsage() result.
- UI (Dashboard header, left of the live pill): a mono **usage pill** —
  `5h ▮▮▯ 34% · wk ▮▯▯ 81%` with per-window colour (cyan <70, amber ≥70, red ≥90),
  title tooltip = reset times + "updated N ago"; dimmed with an "· stale" suffix when
  stale. Hidden entirely when `configured=false`.
- README: short "usage limits in the header" setup section (set `statusLine` in
  `~/.claude/settings.json` to the bridge).

## Owner setup (this machine, done as part of the feature)

Add to `~/.claude/settings.json` (user-approved edit; the app itself never writes
there): `"statusLine": {"type": "command", "command": "node <repo>/scripts/statusline-bridge.mjs"}`
— also gives the owner a statusline in every Claude terminal. Removing that key
reverts everything.

## Out of scope

Calling Anthropic's usage API directly (external call — against the local-only
story); historical usage charts (stats page is a separate feature); per-model quotas.

## Test plan

- **Vitest** (`usage.test.ts`): normalize — 5h/7d shapes, loose key matching, unknown
  keys pass through, percentage clamping, non-numeric dropped; readUsage — missing
  file → configured:false, fresh vs stale via injected now, malformed JSON tolerated.
  Bridge: run it as a child process with fixture stdin + CLAUDE_DECK_CONFIG_DIR →
  file written atomically, one-line stdout, garbage stdin still exits 0.
- **Playwright e2e** (`usage.spec.ts`): global-setup writes a fixture
  rate-limits.json (5h 34%, week 81%) → pill shows both percentages and the amber
  class on week; delete the file + reload → pill absent; stale file → "stale" marker.
- **QA shot**: dashboard header with the usage pill.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
