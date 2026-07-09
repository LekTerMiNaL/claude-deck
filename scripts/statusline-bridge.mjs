#!/usr/bin/env node
// claude-deck statusline bridge.
//
// Set as your Claude Code statusline command (~/.claude/settings.json):
//   "statusLine": { "type": "command", "command": "node /path/to/claude-deck/scripts/statusline-bridge.mjs" }
//
// Claude Code pipes statusline JSON (incl. `rate_limits`) to stdin on every
// refresh. This script persists it to ~/.claude-deck/rate-limits.json so the
// claude-deck web UI can show 5-hour/weekly usage bars, and prints a compact
// one-line statusline. It must NEVER crash the statusline: any failure still
// prints a line and exits 0. No dependencies.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    // malformed stdin — still print something
  }

  const model = data?.model?.display_name ?? null;
  const rateLimits = data?.rate_limits ?? null;

  try {
    const dir = process.env.CLAUDE_DECK_CONFIG_DIR ?? path.join(os.homedir(), ".claude-deck");
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.rate-limits.json.tmp-${process.pid}`);
    fs.writeFileSync(tmp, JSON.stringify({ updatedAt: Date.now(), model, rate_limits: rateLimits }));
    fs.renameSync(tmp, path.join(dir, "rate-limits.json"));
  } catch {
    // persisting is best-effort
  }

  // compact statusline: "<model> · 5h 34% · wk 12%"
  const parts = [];
  if (model) parts.push(model);
  if (rateLimits && typeof rateLimits === "object") {
    for (const [key, win] of Object.entries(rateLimits)) {
      if (!win || typeof win !== "object" || typeof win.used_percentage !== "number") continue;
      const label = /five|5/.test(key) ? "5h" : /seven|7|week/.test(key) ? "wk" : key;
      parts.push(`${label} ${Math.round(win.used_percentage)}%`);
    }
  }
  console.log(parts.join(" · ") || "claude");
});
