# Phase 6 (feature) — GitHub Actions CI

## Summary & goal

The full gate (typecheck · build · Vitest · Playwright e2e) runs automatically on every
push to `main` and every PR, so fork contributions get checked before merge and the repo
wears a green badge.

## Design

- `.github/workflows/ci.yml`, single `gate` job on `ubuntu-latest`:
  1. checkout, setup-node 20 with npm cache,
  2. `npm ci` (also builds via the `prepare` script),
  3. `npm run typecheck`,
  4. Playwright chromium cached by version (`~/.cache/ms-playwright`), installed
     `--with-deps` on cache miss (deps always installed),
  5. `npm test` (62 unit), `npm run test:e2e` (35 e2e — everything runs on synthesized
     fixtures, no real data, linux-safe: fake pids, fake claude bin is a sh script,
     fake open-terminal sink),
  6. upload `test-results/` as an artifact on failure.
- README badge → the workflow on `main`.
- 15-minute job timeout so a hung e2e can't burn minutes.

## Test plan

CI is itself the test: after merge to main, `gh run watch` until the first run is green.
Local gate stays the source of truth before every merge.

## Gate

Local gate green → merge → push → **verify the GitHub run is green** (fix-forward if the
linux environment surprises us).
