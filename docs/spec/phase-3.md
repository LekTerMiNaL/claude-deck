# Phase 3 — AI summaries · open-in-Terminal · cross-project timeline

## Summary & goal

The three "after real use" features:
1. **AI summary** of a session on demand (button in session view) via local `claude -p`.
2. **Open in Terminal** (macOS): resume a session in a real Terminal window instead of
   copy-paste.
3. **Timeline**: one reverse-chronological feed of prompts across ALL projects,
   grouped by day — "what was I doing yesterday, everywhere?"

## 1) AI summaries

- `POST /api/session/summary {path, id}` →
  - Build input from the transcript tail (`parseThread`, last ~40 messages, text
    truncated per message) — NOT the raw jsonl.
  - Spawn `claude -p <prompt>` with `--model haiku` for speed/cost; 90s timeout;
    cwd = os tmpdir (not the project — avoid loading the project's CLAUDE.md/session
    hooks); strip ANSI.
  - Prompt asks for a 2-4 sentence Thai summary of what the session did + open work.
  - **Cache** in `<configDir>/summaries.json` keyed by sessionId, stamped with the
    transcript size at summarize time; a changed size invalidates. `GET` variant
    returns cache without spawning.
  - Env overrides: `CLAUDE_DECK_CLAUDE_BIN` (tests point it at a fake script),
    disabled with 503 when the binary is missing (feature-detect via spawn failure).
- UI: `✦ summarize` button in the session header; shows spinner state, renders the
  summary in a glass card above the thread, re-summarize allowed. Errors surface
  inline, non-blocking.

## 2) Open in Terminal (macOS only)

- `POST /api/open-terminal {path, id}` → feature-detect: `process.platform === "darwin"`
  and `osascript` present → `osascript -e 'tell application "Terminal" to do script
  "cd <q(path)> && claude --resume <id>"' -e '… activate'`; quotes escaped; uuid guard
  on id, path must exist on disk. 501 when unsupported.
- `GET /api/capabilities` → `{openTerminal: boolean, summarize: boolean}` so the UI
  only shows buttons that will work.
- Test hook: `CLAUDE_DECK_FAKE_OPEN=<file>` appends the would-be command to a file
  instead of running osascript (also forces capability=true) so e2e can assert it.
- UI: `open in Terminal ⧉` button next to copy in the session header.

## 3) Cross-project timeline

- `GET /api/timeline?limit=N` (default 100) → most recent history entries across all
  projects: `{ts, display, project, projectName, sessionId, inDeck}` sorted desc.
  Reuses the history index (mtime-cached); no new file reads.
- UI route `/timeline`: header nav link `## timeline`; entries grouped by day
  (Today / Yesterday / date), each row: time (mono), project chip (violet border,
  clickable → project view), prompt text (one line, ellipsis), `open ↗` to the session.
  Same Midnight × Terminal styling.
- Dashboard header gets a small `timeline` nav link; timeline header links back.

## Out of scope

Summaries for whole projects; streaming summary tokens; Linux/Windows terminal
launchers; timeline filtering/search (later if wanted).

## Test plan

- **Vitest**: summary cache read/write + size invalidation; prompt builder truncation;
  osascript command construction + quoting (never executed); timeline aggregation
  (sorted, limited, cross-project, inDeck flags).
- **Playwright e2e**: fake `claude` bin (shell script echoing a canned summary) →
  summarize button renders the summary and caches (second click instant, spawn count
  file asserts single spawn); fake-open file receives `cd … && claude --resume …` on
  button click; timeline lists fixture prompts from multiple projects grouped by day,
  chips navigate to the project.
- **QA shots**: timeline + session view with summary, desktop + mobile.

## Gate

typecheck · build · unit · e2e green → merge `--no-ff` into main; tick Phase 3 in
CLAUDE.md status.
