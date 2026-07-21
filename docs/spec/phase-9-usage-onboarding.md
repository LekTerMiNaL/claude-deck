# Phase 9 — usage-bar onboarding: in-app hint (A) + `setup-statusline` CLI (B)

## Problem

The usage bars need `~/.claude-deck/rate-limits.json`, written only once the user wires
`scripts/statusline-bridge.mjs` into their Claude Code `statusLine`. Until then
`readUsage()` returns `configured:false` and the pill is hidden **silently** — a new
user can't tell if it's broken, missing, or unsupported.

Root constraint (respected, not fought): Claude Code exposes `rate_limits` **only** by
piping JSON to a `statusLine` command. The bridge is the only mechanism. The **server
never writes `~/.claude`**.

## Decision (owner-approved 2026-07-21)

Full A + B. B's CLI is the **one sanctioned write to `~/.claude`** — user-invoked only,
backup-first, non-clobbering. CLAUDE.md's "read-only, always" rule gains this one narrow,
documented exception; the server side of the rule is unchanged.

## Feature A — in-app setup hint (pure display, no writes)

- `usage.ts` `usageSetup()` → `{ bridgePath, settingsPath, snippet }`. `bridgePath`
  resolved from the module's own location up to the package root (works in `npm run dev`
  and `npx`); `settingsPath = <claudeDir>/settings.json`; `snippet` = the exact
  `"statusLine": { "type": "command", "command": "node <bridgePath>" }` block.
- `GET /api/usage/setup` → `usageSetup()`. `api.usageSetup()` + `UsageSetup` type.
- Dashboard: when `usage && !usage.configured` and not dismissed → `UsageSetupHint` in
  the pill slot (`❯ set up usage bars`, click → panel with the snippet, Copy button,
  the settings path, "restart Claude Code", and the `npx claude-deck setup-statusline`
  shortcut). `×` dismisses via `localStorage["claude-deck:usage-hint-dismissed"]`.
  Never shown while `usage === null`. Token classes only (all 11 themes).

## Feature B — `claude-deck setup-statusline`

- `bin/claude-deck.js`: if `argv[0] === "setup-statusline"`, dispatch to
  `bin/setup-statusline.js` and skip the server.
- `bin/setup-statusline.js` (plain node, no deps) — pure exported helpers:
  - `mergeStatusLine(settings, command)` → new settings with our `statusLine`, other
    keys preserved.
  - `statusLineState(settings, ourCommand)` → `"absent" | "ours" | "foreign"`.
  - `stripStatusLine(settings, ourCommand)` → removes only if `"ours"`.
  - `run(argv)` (IO): resolve paths; read settings (missing→`{}`, malformed→error, never
    write); by state: absent→backup(if existed)+merge+write; ours→"already set up ✓";
    foreign→refuse without `--force`, print current + manual snippet. `--revert` strips
    ours. Backup = copy to `settings.json.bak-<YYYYMMDD-HHMMSS>`; atomic write; 2-space
    indent. `--print`/`--dry-run` emits snippet+path and writes nothing. `--claude-dir`
    + `CLAUDE_DECK_CLAUDE_DIR` honored (tests). Returns an exit code.

## Test plan

- **Vitest**: `usage.test` — `usageSetup()` path ends `scripts/statusline-bridge.mjs`,
  snippet has `"type": "command"` + the path. `setup-statusline.test` — pure helpers +
  temp-dir integration (write+backup, idempotent 2nd run, foreign refuse/`--force`,
  `--revert`, `--print` no-write, malformed no-write).
- **Playwright e2e** (`usage.spec`): no `rate-limits.json` → hint visible, pill absent;
  click → panel + copy; dismiss + reload → hint gone; with fixture file → hint gone,
  pill present.
- **QA**: header empty-state hint across a couple themes.

## Gate

typecheck · build · unit · e2e green. A and B as separate commits on the branch;
`merge --no-ff`; push.
