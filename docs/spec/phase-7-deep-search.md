# Phase 7 — full-text transcript search ("deep search")

## Summary & goal

Prompt search (`/search`) finds what *you* typed. Deep search finds what *Claude said*
— "which session mentioned regolith?" — across every transcript of every project.

## Feasibility (measured on this machine)

The 135 MB vesta transcript extracts to **2.3 MB of renderable text (3,530 messages)
in 1.4 s** (line pre-filter + JSON parse of message lines only). The whole ~408 MB
corpus ≈ ~5 s one-time; transcripts are **append-only**, so subsequent refreshes only
parse new bytes. Extracted text totals ~10 MB → a case-insensitive substring scan is
tens of ms. **No inverted index needed** — and substring matching is what Thai
requires anyway (no word boundaries).

## Design

- **Text cache** at `<configDir>/text-index/<encoded-project>/<sessionId>.jsonl`
  (our dir — `~/.claude` untouched):
  - one line per renderable message: `{ts, role, text}` (same skip rules as the
    thread parser: only user/assistant, no sidechain/meta, no tool_result carriers);
  - sibling `<sessionId>.meta.json`: `{offset, size, mtimeMs}` — unchanged
    size+mtime → skip; size grew → parse from `offset` (append-only); size shrank →
    full rebuild.
- `data/text-index.ts`:
  - `refreshTextIndex()` — walk `projects/` (real paths recovered via
    `knownRealPaths()`, unresolved orphans use the encoded name), extract deltas,
    return `{files, newMessages, ms}`. Main transcripts only (subagents: v2).
  - `deepSearch(q, limit)` — scan the cache, return matches newest-first:
    `{project, projectName, displayPath, sessionId, role, ts, snippet}` where
    `snippet` is ±~90 chars around the first hit; plus `total`.
- API: `GET /api/search/deep?q=…&limit=` — refreshes the index (incremental), then
  searches. Response includes `indexMs` so the UI can hint on a slow first build.
- **UI** (`/search`): two mode chips — `❯ prompts` (default, instant) and
  `✦ full text`. Deep rows show the role marker (❯ you / ✦ claude), project chip,
  highlighted snippet, `open ↗` to the session. "indexing…" state on first run.
  Mode kept in the URL (`&mode=deep`).

## Out of scope

Subagent transcript indexing; regex; relevance ranking (recency order is the
mental model here); watching for changes (index refreshes per search).

## Test plan

- **Vitest** (`text-index.test.ts`): extraction skip-rules; incremental append only
  parses the delta (offset advances, no duplicate lines); shrunken file → rebuild;
  Thai + case-insensitive matching; snippet windowing; limit vs total; missing
  cache dir tolerated.
- **Playwright e2e** (`e2e/deep-search.spec.ts`): "regolith" exists ONLY in the
  moon transcript (assistant text, never a prompt) → prompts mode finds 0, full-text
  finds it with the ✦ marker; `open ↗` lands in the moon session; mode survives
  reload via URL; second search is served from the warm index.
- **QA shot**: deep results with highlight.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
