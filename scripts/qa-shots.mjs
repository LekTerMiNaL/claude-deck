// QA screenshots against the synthesized e2e fixture world (never real data).
// Usage: npm run build && npm run qa:shots  (runs under tsx so it can reuse
// the e2e fixture builder written in TS)
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import globalSetup from "../e2e/global-setup.ts";

const OUT = process.argv[2] ?? "shots";
const PORT = 5759;
const BASE = `http://127.0.0.1:${PORT}`;

fs.mkdirSync(OUT, { recursive: true });
globalSetup();

const configDir = path.resolve("e2e/.tmp-config-qa");
fs.rmSync(configDir, { recursive: true, force: true });

// usage pill data as the statusline bridge would write it
fs.mkdirSync(configDir, { recursive: true });
fs.writeFileSync(
  path.join(configDir, "rate-limits.json"),
  JSON.stringify({
    updatedAt: Date.now(),
    model: "Fixture Model",
    rate_limits: {
      five_hour: { used_percentage: 34, resets_at: "2026-07-10T05:00:00Z" },
      seven_day: { used_percentage: 81, resets_at: "2026-07-14T00:00:00Z" },
    },
  }),
);

const server = spawn("node", ["dist/server/index.js"], {
  env: {
    ...process.env,
    CLAUDE_DECK_PORT: String(PORT),
    CLAUDE_DECK_CLAUDE_DIR: path.resolve("e2e/fixtures/claude-home"),
    CLAUDE_DECK_CONFIG_DIR: configDir,
    CLAUDE_DECK_FAKE_PIDS: "111111,222222",
    CLAUDE_DECK_CLAUDE_BIN: path.resolve("e2e/fixtures/fake-claude.sh"),
    CLAUDE_DECK_FAKE_OPEN: path.resolve("e2e/.tmp-open-log"),
  },
  stdio: "inherit",
});

for (let i = 0; i < 50; i++) {
  try {
    const res = await fetch(`${BASE}/api/live`);
    if (res.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const b = await chromium.launch();
const desktop = await b.newPage({ viewport: { width: 1280, height: 900 } });
const mobile = await b.newPage({ viewport: { width: 390, height: 844 } });

// 1. empty deck (with notifications enabled so the bell shows its 🔔 state)
await desktop.addInitScript(`
  window.__notifs = [];
  class FakeNotification { static permission = "granted"; static requestPermission(){return Promise.resolve("granted");} constructor(){} }
  window.Notification = FakeNotification;
`);
await desktop.goto(BASE);
await desktop.waitForSelector('[data-testid="add-card"]');
await desktop.getByTestId("notif-toggle").click();
await desktop.screenshot({ path: `${OUT}/1-dashboard-empty.png`, fullPage: true });

// 2. add modal (scan list with orphan)
await desktop.getByRole("button", { name: "+ Add project", exact: true }).click();
await desktop.waitForSelector('[data-testid="scan-row"]');
await desktop.screenshot({ path: `${OUT}/2-add-modal.png`, fullPage: true });

// 3. populated deck: add two projects + register root + add empty-lab
await desktop.getByTestId("scan-row").filter({ hasText: "rocket-shop" }).getByRole("button", { name: "+ Add" }).click();
await desktop.getByTestId("scan-row").filter({ hasText: "moon-blog" }).getByRole("button", { name: "+ Add" }).click();
await desktop.getByTestId("path-input").fill(path.resolve("e2e/fixtures/workspace"));
await desktop.getByTestId("add-root-btn").click();
await desktop.waitForSelector('[data-testid="root-child-row"]');
await desktop.screenshot({ path: `${OUT}/3-add-modal-root.png`, fullPage: true });
await desktop.getByTestId("root-child-row").filter({ hasText: "empty-lab" }).getByRole("button", { name: "+ Add" }).click();
await desktop.keyboard.press("Escape");
await desktop.waitForSelector('[data-testid="deck-card"]');
await desktop.screenshot({ path: `${OUT}/4-dashboard-populated.png`, fullPage: true });

// 5. mobile view of the populated dashboard
await mobile.goto(BASE);
await mobile.waitForSelector('[data-testid="deck-card"]');
await mobile.screenshot({ path: `${OUT}/5-dashboard-mobile.png`, fullPage: true });

// 6. session view (desktop + mobile) — rocket-shop has the realistic thread
await desktop.locator('[data-testid="deck-card"]', { hasText: "rocket-shop" }).click();
await desktop.waitForSelector('[data-testid="thread"]');
await desktop.screenshot({ path: `${OUT}/6-session-view.png`, fullPage: true });
await mobile.locator('[data-testid="deck-card"]', { hasText: "rocket-shop" }).click();
await mobile.waitForSelector('[data-testid="thread"]');
await mobile.screenshot({ path: `${OUT}/7-session-mobile.png`, fullPage: true });

// 8. session view with AI summary (fake claude bin)
await desktop.getByTestId("summarize-btn").click();
await desktop.waitForSelector('[data-testid="summary-card"]');
await desktop.screenshot({ path: `${OUT}/8-session-summary.png`, fullPage: true });

// 9. timeline
await desktop.goto(`${BASE}/timeline`);
await desktop.waitForSelector('[data-testid="timeline-row"]');
await desktop.screenshot({ path: `${OUT}/9-timeline.png`, fullPage: true });

// 13. stats page (desktop + mobile)
await desktop.goto(`${BASE}/stats`);
await desktop.waitForSelector('[data-testid="chart-card"]');
await desktop.waitForTimeout(300);
await desktop.screenshot({ path: `${OUT}/13-stats.png`, fullPage: true });
await mobile.goto(`${BASE}/stats`);
await mobile.waitForSelector('[data-testid="chart-card"]');
await mobile.screenshot({ path: `${OUT}/14-stats-mobile.png`, fullPage: true });

// 12. search with a match highlighted
await desktop.goto(`${BASE}/search?q=rocket`);
await desktop.waitForSelector('[data-testid="search-row"]');
await desktop.screenshot({ path: `${OUT}/12-search.png`, fullPage: true });

// 10. agent tree (rocket-shop's session has subagents), one expanded — desktop + mobile
const rocketUrl = `${BASE}/project?path=${encodeURIComponent(path.resolve("e2e/fixtures/workspace/rocket-shop"))}`;
await desktop.goto(rocketUrl);
await desktop.waitForSelector('[data-testid="agent-tree"]');
await desktop
  .locator('[data-testid="agent-row"]', { hasText: "Build the checkout form" })
  .getByTestId("agent-toggle")
  .click();
await desktop.waitForSelector('[data-testid="agent-thread"]');
await desktop.screenshot({ path: `${OUT}/10-agent-tree.png`, fullPage: true });
await mobile.goto(rocketUrl);
await mobile.waitForSelector('[data-testid="agent-tree"]');
await mobile.screenshot({ path: `${OUT}/11-agent-tree-mobile.png`, fullPage: true });

await b.close();
server.kill();
fs.rmSync(configDir, { recursive: true, force: true });
console.log(`shots written to ${OUT}/`);
