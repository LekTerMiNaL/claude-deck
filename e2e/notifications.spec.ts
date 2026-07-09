import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Records Notification constructions into window.__notifs and reports
// permission already granted, then speeds up the live poll.
const STUB = `
  window.__CLAUDE_DECK_POLL_MS__ = 400;
  window.__notifs = [];
  class FakeNotification {
    static permission = "granted";
    static requestPermission() { return Promise.resolve("granted"); }
    constructor(title, opts) { window.__notifs.push({ title, body: opts && opts.body }); }
  }
  window.Notification = FakeNotification;
`;

const SESSIONS_DIR = path.resolve("e2e/fixtures/claude-home/sessions");
const ROCKET_FILE = path.join(SESSIONS_DIR, "111111.json");

function setRocketStatus(status: "busy" | "idle") {
  const data = JSON.parse(fs.readFileSync(ROCKET_FILE, "utf8"));
  data.status = status;
  fs.writeFileSync(ROCKET_FILE, JSON.stringify(data));
}

test("bell toggle enables notifications and persists across reload", async ({ page }) => {
  await page.addInitScript(STUB);
  await page.goto("/");

  const bell = page.getByTestId("notif-toggle");
  await expect(bell).toHaveText(/notify/);
  await bell.click();
  await expect(bell).toHaveText("🔔 notify"); // granted

  await page.reload();
  await expect(page.getByTestId("notif-toggle")).toHaveText("🔔 notify"); // remembered via localStorage
});

test("fires a notification when a busy session goes idle", async ({ page }) => {
  await page.addInitScript(STUB);
  try {
    await page.goto("/");
    await page.getByTestId("notif-toggle").click();

    // baseline poll sees rocket-shop busy; no notification yet
    await expect(page.getByTestId("live-pill")).toHaveText(/1 session running/);
    expect(await page.evaluate(() => (window as any).__notifs.length)).toBe(0);

    // the session finishes → busy transitions to idle on disk
    setRocketStatus("idle");

    await expect
      .poll(() => page.evaluate(() => (window as any).__notifs.length), { timeout: 8000 })
      .toBeGreaterThan(0);
    const notifs = await page.evaluate(() => (window as any).__notifs);
    expect(notifs[0].title).toContain("rocket-shop-7");
    expect(notifs[0].title).toContain("finished");
    expect(notifs[0].body).toContain("rocket-shop");
  } finally {
    setRocketStatus("busy"); // restore for later serial specs
  }
});

test("does not fire on a plain load with no transition", async ({ page }) => {
  await page.addInitScript(STUB);
  await page.goto("/");
  await page.getByTestId("notif-toggle").click();
  await page.waitForTimeout(1200); // several fast polls, status unchanged
  expect(await page.evaluate(() => (window as any).__notifs.length)).toBe(0);
});
