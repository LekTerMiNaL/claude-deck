# Phase 8 — themes: midnight (default) · arcade · dopamine

## Summary & goal

A theme switcher in the header cycling three looks, remembered per browser:
- **midnight** — the existing Midnight × Terminal (default, unchanged),
- **arcade** — approved mock `docs/mockups/theme-arcade.html` (v2 "soft synthwave"):
  purple night sky + stars + neon horizon grid, pixel display font, neon
  pink/cyan/lime accents, glow-styled cards,
- **dopamine** — approved mock `docs/mockups/theme-dopamine.html`: cream surface,
  candy accents, chunky display font, neo-brutalist cards (strong border +
  hard offset shadow).

## Approach

The whole app already reads colors from Tailwind v4 `@theme` tokens
(`--color-bg/ink/muted/faint/line/glass/vio/cyan/busy`, `--font-*`,
`--color-series-*`). Tailwind v4 utilities compile to `var(--color-*)`, so a theme
is just a `[data-theme="…"]` block overriding those variables — zero component
rewrites for colors/fonts.

- **New tokens** (and de-hardcoding): `--color-panel` (modal/tooltip surface,
  was `#0d1122`), `--color-warn` (`#fbbf24`), `--color-danger` (`#f87171`) —
  components switch to `bg-panel` / `text-warn` / `text-danger`.
- **Structure restyle without component edits**: cards all carry `.bg-glass`, so
  `[data-theme="dopamine"] .bg-glass { border/box-shadow … }` gives the
  neo-brutalist look, and the arcade block adds glow — a few CSS rules each.
- **Backgrounds**: theme-scoped `body::before/::after` (arcade: stars + synthwave
  horizon; dopamine: pastel blobs); the existing `.glow` divs recolor per theme.
- **Fonts** (bundled, no external calls): `@fontsource/press-start-2p`,
  `@fontsource/vt323` (arcade), `@fontsource/bricolage-grotesque` (dopamine).
- **Switcher**: `lib/theme.ts` — `THEMES = ["midnight","arcade","dopamine"]`,
  localStorage `claudeDeck.theme`, `applyTheme()` sets
  `document.documentElement.dataset.theme` (midnight = no attribute). Applied at
  boot in `main.tsx`; a header button on the dashboard cycles ◐ → 🕹 → 🍭.

## Chart palettes (validated per surface — reimplemented six-checks script in the
session scratchpad after the bundled one wasn't materialized; sanity-checked to
reproduce the reference result exactly: worst ΔE 16.2 protan on the midnight set)

| Theme | Surface | Series 1-4 | Result |
|---|---|---|---|
| midnight | `#12152a` | `#8b5cf6 #0891b2 #16a34a #d97706` | ALL PASS (ΔE 16.2) |
| arcade | `#241645` | same set | ALL PASS (contrast ≥3.89) |
| dopamine | `#fffdf8` | `#7c3aed #ea580c #0369a1 #db2777` | ALL PASS (ΔE 19.2) |

## Out of scope

Per-theme copy ("NEW GAME", XP bars — the arcade mock's copy gimmicks stay
mock-only for now; v1 swaps skin, not wording); per-page switchers (dashboard
only, theme persists everywhere); OS dark/light auto-detection.

## Test plan

- **Vitest** (`theme.test.ts`): normalize/persist round-trip, invalid stored
  value → midnight, cycle order midnight→arcade→dopamine→midnight.
- **Playwright e2e** (`e2e/themes.spec.ts`): default has no `data-theme` and the
  midnight bg color; clicking the switcher sets `data-theme=arcade` AND the body
  background actually changes (computed style); another click → dopamine (light
  bg); persists across reload and on other pages (/stats); third click returns
  to midnight.
- **QA shots**: dashboard ×3 themes, session view + stats in one non-default
  theme.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
