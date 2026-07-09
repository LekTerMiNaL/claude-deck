# Phase 6 (feature) — remove a project / root from the deck

## Summary & goal

The deck can grow but never shrink from the UI. Add the two missing affordances:
remove a project from the deck (deck card ✕) and unregister a root folder (in the
add-project modal). Both touch ONLY `~/.claude-deck/config.json` — nothing on disk,
nothing in `~/.claude`, is ever deleted.

## Design

- **Deck card ✕**: small `✕` in the traffic-light bar, faint until hovered. First
  click arms it (`sure?` in amber, 3s window), second click removes — no modal
  dialog. The card's own click still navigates; ✕ stops propagation. (Card wrapper
  becomes a clickable div so buttons can nest legally.)
- **Roots**: the add-modal gains a `registered roots` line above the root-children
  section listing each root with its own `✕ remove` (same arm-then-confirm pattern).
  Removing a root just stops listing its subfolders — projects already added stay.
- API: `DELETE /api/roots {path}` (config-only, mirrors `DELETE /api/deck` which
  already exists); `removeRoot()` added to config.ts.

## Out of scope

Deleting summaries cache entries for removed projects; bulk clear; undo (re-adding
is two clicks).

## Test plan

- **Vitest**: `removeRoot` removes and is a no-op on unknown paths (config intact).
- **Playwright e2e** (`e2e/remove.spec.ts`, self-contained state: adds its own temp
  root + uses the ghost-app deck entry no later spec depends on): ✕ arms then
  removes a deck card (count drops, config survives reload); removing a registered
  root makes its children vanish from the modal while previously-added projects
  stay in the deck; single ✕ click alone does NOT remove (disarms after timeout not
  asserted — just assert card still present after one click + reload).
- **QA shot**: deck card with the armed `sure?` state.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push.
