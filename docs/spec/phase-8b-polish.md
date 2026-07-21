# Phase 8b — polish: theme picker, usage panel, arcade readability

Owner feedback on Phase 8, three fixes before adding more themes.

## 1) Theme picker modal (replaces the cycle button)

- The header theme button now OPENS a modal (same traffic-light chrome as the
  add-project modal) instead of blind-cycling.
- Grid of theme cards, one per theme: a **CSS mini-preview** (theme bg swatch
  containing a tiny fake card — title-bar dots, two text lines, an accent chip —
  painted with that theme's real colors + display font), the theme icon+name, and a
  `✓ active` mark. Clicking a card applies instantly (live preview behind the
  modal); Esc/✕/backdrop closes.
- `lib/theme.ts`: `THEME_META` gains `preview` colors; `nextTheme()` retired.

## 2) Usage: click the pill → inline detail panel

- The header pill stays as-is; clicking it toggles a **full-width panel inserted
  under the header** (no new page): per window — long bar, big %, window name
  ("5-hour session" / "weekly"), `resets <local datetime>`; footer — model,
  `updated N ago`, "fed by the statusline bridge". Click pill (or ✕) to collapse.

## 3) Arcade readability

- Pixel font (`Press Start 2P`) stays ONLY on `--font-disp` (headings, buttons,
  card titles = the flavor). `--font-body` returns to Inter and `--font-mono` to
  JetBrains Mono — VT323 dropped entirely (import removed).

## Test plan

- **Vitest**: theme meta has previews for every THEME; nextTheme removed.
- **Playwright e2e** (update `themes.spec.ts`, extend `usage.spec.ts`):
  - theme button opens the modal; picking arcade sets `data-theme` + live bg
    change + `✓ active` moves; persists across reload; Esc closes; garbage
    localStorage still falls back to midnight.
  - arcade body font-family computed style contains "Inter" (readability guard).
  - usage pill click → panel shows both windows + reset times; second click hides.
- **QA shots**: theme modal, expanded usage panel, arcade dashboard after the font
  fix.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
