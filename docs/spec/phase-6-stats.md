# Phase 6 (feature) — stats page

## Summary & goal

`/stats`: how much Claude actually gets used, at a glance — headline totals, activity
per day, tokens per model, busiest hours. Built on cheap, already-on-disk sources; no
transcript scanning.

## Data sources (verified)

- `~/.claude/stats-cache.json` (maintained by Claude Code, mtime-cached read):
  `dailyActivity[{date, messageCount, sessionCount, toolCallCount}]`,
  `dailyModelTokens[{date, tokensByModel}]`, `modelUsage{model→tokens}`,
  `totalSessions`, `totalMessages`, `hourCounts{0-23}`. May be missing → page still
  renders what it can.
- `history.jsonl` → prompts/day (last 30 days) + total prompts — always fresh.

## Form decisions (per the dataviz method — job picks the form)

| Data | Job | Form |
|---|---|---|
| totals (sessions, messages, prompts, tool calls) | headline numbers | **KPI row of stat tiles** (not charts) |
| prompts/day (30d) | magnitude over time, 1 series | **column chart**, slot-1 hue, no legend (title names it) |
| messages/day vs tool calls/day | two magnitudes, same unit | **small multiples** — two single-series column charts (beats a 60-column grouped chart) |
| tokens/day by model | magnitude + identity | **stacked columns**, categorical slots 1..N (≤4 models, tail → "Other"), legend + tooltip |
| hourCounts | magnitude across 24 fixed bins | **column chart**, slot-1 hue |

## Color (validated, not eyeballed)

Chart marks use darker steps of the brand hues — the UI accents (#a78bfa/#67e8f9) are
outside the dark-mode lightness band, so marks get their own tokens:

`--series-1 #8b5cf6 (violet) · --series-2 #0891b2 (cyan) · --series-3 #16a34a (green)
· --series-4 #d97706 (amber)` on chart surface `#12152a` (bg + glass composite).
`validate_palette.js --mode dark --surface "#12152a"` → **ALL CHECKS PASS**, worst
adjacent CVD ΔE 16.2 (target ≥12). Fixed slot order, never cycled; >4 models fold
into "Other" (slot-4 wears it last).

## Mark/chrome specs applied

Columns ≤24px wide, 4px rounded top (data end), square baseline; 2px surface gaps
between stacked segments and between adjacent columns; hairline solid gridlines
(#ffffff@6%); axis/labels in muted ink (never series-colored text); y-ticks rounded,
compact (1.2K/17M). Every chart card: hover/focus **tooltip** (per-column, ≥24px hit
via full-height hit rects, keyboard-focusable) and a **⊞ table toggle** (the
WCAG-clean twin — tooltips enhance, never gate). No dual axes anywhere.

## Server

`data/stats.ts`: `readStatsCache()` (tolerant parse) + `promptsPerDay(days=30)` from
history; `GET /api/stats` → `{totals{sessions,messages,prompts,toolCalls},
promptsPerDay[{date,count}], daily[{date,messages,tools}], tokens{models[],
perDay[{date, byModel}]}, hourCounts[24]}` — models sorted by total desc, capped at 4
with "Other" aggregation.

## UI

`/stats` route + `## stats` nav link (dashboard header, timeline/search crumbs).
Layout: KPI row (4 tiles: mono label, big ink value, no decoration) → prompts/day →
messages/day + tools/day side by side → tokens/day stacked (legend chips under title)
→ hours mini chart. All SVG, no chart lib, no new deps. Charts hold previous render
during poll refetch (no skeleton flash) — actually static fetch-once page (no poll).

## Out of scope

Cost estimation; per-project drilldowns; date-range filters (data is ~35 days deep);
light mode (app is dark-only).

## Test plan

- **Vitest** (`stats.test.ts`): promptsPerDay groups by local date + fills gaps +
  caps at N days; stats-cache tolerant parse (missing file → zeroed shape); model
  cap + "Other" fold; hourCounts normalization (sparse object → 24 array).
- **Playwright e2e** (`e2e/stats.spec.ts`): fixture stats-cache.json + history →
  KPI values, chart cards render with correct column counts, tooltip appears on
  hover with the right value, table toggle swaps to a readable table, legend lists
  models, nav link works.
- **QA shot**: stats page desktop + mobile.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
