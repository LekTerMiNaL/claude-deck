# Phase 8c — eight more themes

Adds the themes proposed to the owner, all as additive `[data-theme]` token blocks
(same mechanism as Phase 8) + `THEME_META` entries the picker renders automatically.
Total themes: **11**.

## The themes

| key | look | surface | chart set |
|---|---|---|---|
| phosphor | green CRT terminal, mono font, subtle scanlines | dark `#0a1410` | midnight set |
| neon-tokyo | cyberpunk red/gold/cyan, neon horizon grid | dark `#12071f` | midnight set |
| dracula | the classic dev palette | dark `#282a36` | midnight set |
| nord | arctic muted | dark `#2e3440` | midnight set |
| catppuccin | mocha pastel dark | dark `#1e1e2e` | midnight set |
| mono | grayscale chrome | dark `#0c0c0c` | midnight set (see note) |
| paper | newsprint, light, Lora serif | light `#f4f1e8` | dopamine set |
| thai | gold + crimson + jade, warm light | light `#fbf3e0` | dopamine set |

## Chart-palette validation (six-checks reimplementation in scratchpad; sanity-matched
to the reference midnight result ΔE 16.2)

All 8 surfaces PASS lightness band + chroma floor + CVD (worst adjacent ΔE 16.2 dark /
19.2 light). **dracula / nord / catppuccin** return a **contrast WARN** (bar fill
2.4–3.9:1 on their mid-dark card surfaces) — permitted: every chart ships the `⊞ table`
twin **and** a legend, which are the required relief channels, and identity never rests
on bar-contrast alone. These palettes are faithful reproductions where soft contrast is
the intended aesthetic.

**Mono note:** the chrome is grayscale, but `--color-series-*` stays the validated
colored set — data-viz is the one place hue *carries meaning* (per-model tokens), so
killing it would break the encoding. Colored charts inside a monochrome UI is the
deliberate, defensible choice.

## De-hardcoding

- Chart gridline was `rgba(255,255,255,0.06)` (invisible on light themes) → new
  `--color-grid` token (also added to dopamine, which had the same latent bug).

## Fonts (bundled, no external calls)

- `@fontsource/lora` (paper). All other new themes reuse existing families
  (Space Grotesk / Inter / JetBrains Mono) — they are palette swaps.

## Out of scope

Per-theme decorative flourishes beyond a light background gradient/scanline; theme-
specific copy.

## Test plan

- **Vitest**: existing `theme.test` already asserts every `THEMES` entry has preview
  meta — now covers all 11. Add: THEMES length ≥ 11, all keys unique.
- **Playwright e2e** (`themes.spec.ts`): existing midnight/arcade/dopamine flow, plus a
  **data-driven loop** opening the picker and applying EACH theme, asserting
  `data-theme` is set (or cleared for midnight) and the computed body background is the
  expected per-theme value; then reset to midnight.
- **QA shots**: dashboard for each new theme (crops) + one light-theme stats page.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
