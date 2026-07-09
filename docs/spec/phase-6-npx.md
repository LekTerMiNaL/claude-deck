# Phase 6 (feature) — `npx claude-deck`: one-command install & run

## Summary & goal

Anyone (and the owner, from any machine) can run the deck with a single command —
no clone/build dance:

```sh
npx github:LekTerMiNaL/claude-deck          # today
npx @lekterminal/claude-deck                # after publishing to npm (optional)
```

It builds on install, starts the server on 127.0.0.1:5757 and opens the browser.

## Naming reality (checked)

`claude-deck` is **taken on npm** (someone else's v0.1.0). Package name becomes
**`@lekterminal/claude-deck`**; the **binary stays `claude-deck`**. The GitHub-install
path works regardless of the npm name and is the primary story until the owner decides
to `npm publish` (needs npm login — deliberately NOT done as part of this feature).

## Pieces

- `bin/claude-deck.js` — plain-node ESM launcher, no deps:
  - flags: `--port/-p <n>`, `--no-open`, `--help`, `--version` (reads package.json);
  - guards main-run behind a "was I executed directly?" check so tests can import its
    pure helpers (`parseArgs`, `openCommand`);
  - spawns `node dist/server/index.js` (child, inherited stdio) with
    `CLAUDE_DECK_PORT`, polls `/api/live` until ready, then opens the browser:
    darwin `open` / win32 `cmd /c start` / linux `xdg-open` (`openCommand` is pure);
  - forwards SIGINT/SIGTERM to the child; exits with the child's code.
- `package.json`:
  - `name: @lekterminal/claude-deck`, drop `"private": true`,
    `bin: {"claude-deck": "bin/claude-deck.js"}`,
    `files: [bin, dist, scripts/statusline-bridge.mjs, docs/screenshots, README, LICENSE]`
    (LICENSE/README are auto-included; screenshots keep the README rendering on npm),
  - `engines.node >= 20`, `repository`/`homepage`/`bugs`/`keywords`,
  - `prepare: npm run build` → `npx github:…` builds from source on install (npm
    installs devDeps for git installs; local `npm install` re-builds too — acceptable),
  - `publishConfig.access: public` for the eventual scoped publish.

## Out of scope

Actually running `npm publish` (owner's call, needs their npm login); auto-update
checks; daemonizing.

## Test plan

- **Vitest** (`bin.test.ts`): `parseArgs` — defaults, `--port`/`-p`, `--no-open`,
  invalid port rejected, help/version flags; `openCommand` — per-platform argv and
  URL passthrough.
- **Playwright e2e** (`e2e/bin.spec.ts`, no browser page):
  - spawn the real bin (`--port 5761 --no-open`) with fixture env → poll
    `/api/live` 200 + `/` serves the app HTML → SIGTERM → child exits;
  - `--version` prints the package version; `--help` mentions flags.
- **Manual**: `npm pack --dry-run` — tarball contains bin/dist/bridge, no fixtures,
  no shots, no source maps of private data (fixtures are synthesized anyway).

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` → push. README updated with the
npx quick-start.
