# Phase 5 (feature 2) — cross-project prompt search

## Summary & goal

"เมื่อไหร่ที่ผมแก้ bug ราคาทอง?" — one search box that greps **every prompt you ever
typed, across all projects**, and deep-links into the exact session. Complements the
timeline (browse by time) with search (find by words).

## Scope decision (verified on this machine)

- `history.jsonl` = 331 KB / 826 prompts → in-memory substring scan is instant; no
  index needed. **v1 searches prompts only.**
- Full transcript text = 408 MB across files → needs a real inverted index (cached,
  invalidated by mtime) to be usable. **Out of scope; noted as v2.**

## Server

- `data/timeline.ts` → generalize the existing walk into
  `historyEntries({ query?, limit })`:
  - walks `history.jsonl` from the end (newest first), same parsing/shape as timeline,
  - `query`: case-insensitive **substring** match on `display` (substring, not word
    boundaries — Thai has no spaces between words),
  - stops once `limit` entries collected.
  - `timeline(limit)` becomes `historyEntries({limit})` — same behaviour as today.
- API `GET /api/search?q=…&limit=N` (default 50, max 200):
  - `q` required, trimmed; empty → `400`.
  - → `{ entries: TimelineEntry[], total: number }` where `total` counts ALL matches
    (so the UI can say "showing 50 of 213") while `entries` is capped by `limit`.

## UI

- New route `/search` (+ `$ search` nav link in the dashboard header, and a search
  link on the timeline page header for symmetry).
- Search page, same brand: header crumb `deck / search`, a `$`-prefixed mono input
  (autofocus), debounce ~250 ms, then rows styled like timeline rows:
  time+date · project chip (→ project view) · prompt with the **matched substring
  highlighted** (violet tint) · `open ↗` (→ exact session).
- States: empty query → hint line; no matches → `no prompts matching "…"`;
  match count line `N matches` (or `showing X of N`).
- Query kept in the URL (`/search?q=…`) so results are shareable/back-button friendly.

## Out of scope

Full-text transcript search (v2: inverted index in `~/.claude-deck/`), regex syntax,
filters by project/date (the query already narrows well in practice).

## Test plan

- **Vitest** (`timeline/search` in `phase3.test.ts` or new file): case-insensitive
  match; Thai substring match; newest-first; `limit` honored while `total` counts all;
  no query → same as timeline; no history file → empty.
- **Playwright e2e** (`e2e/search.spec.ts`, self-sufficient — no deck dependency):
  navigate `/search`; type `moon` → 1 row, highlight visible, chip says moon-blog;
  `open ↗` lands in the moon session; type gibberish → empty state; `rocket` → 2 rows
  (both rocket prompts); URL carries `?q=` after typing and survives reload.
- **QA shot**: search page with results + highlight (desktop).

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` into main → push.
