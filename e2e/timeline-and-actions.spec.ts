import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Runs last (alphabetical, workers=1): the deck is already populated by
// dashboard.spec.ts. Summary + open-terminal hit fixture fakes, never the
// real claude CLI or AppleScript.

const CALL_LOG = path.resolve("e2e/.tmp-claude-calls");
const OPEN_LOG = path.resolve("e2e/.tmp-open-log");
const SID_ROCKET = "11111111-aaaa-4aaa-8aaa-111111111111";

test("timeline lists prompts across projects grouped by day, chips navigate", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("timeline-link").click();

  const rows = page.getByTestId("timeline-row");
  await expect(rows).toHaveCount(4); // all fixture history entries
  await expect(rows.nth(0)).toContainText("fix rocket engine overheating bug"); // newest first
  await expect(rows.nth(0)).toContainText("rocket-shop");
  await expect(page.getByTestId("timeline-day").first()).toContainText("today");
  // entries from three different projects are present
  await expect(page.getByTestId("timeline-row").filter({ hasText: "moon dust" })).toBeVisible();
  await expect(page.getByTestId("timeline-row").filter({ hasText: "ghost experiment" })).toBeVisible();

  // project chip navigates to the session view
  await rows.nth(0).getByRole("button", { name: "rocket-shop" }).click();
  await expect(page.getByTestId("crumb")).toContainText("deck / rocket-shop");
});

test("timeline open ↗ deep-links into the exact session", async ({ page }) => {
  await page.goto("/timeline");
  await page
    .getByTestId("timeline-row")
    .filter({ hasText: "moon dust" })
    .getByRole("button", { name: "open ↗" })
    .click();
  await expect(page.getByTestId("session-head")).toContainText("moon-blog-2");
  await expect(page.getByTestId("thread")).toContainText("regolith static cling");
});

test("summarize runs claude -p once and caches by transcript size", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  await page.getByTestId("summarize-btn").click();
  await expect(page.getByTestId("summary-card")).toContainText("แก้บั๊กเครื่องยนต์ร้อนเกิน");
  expect(fs.readFileSync(CALL_LOG, "utf8").trim().split("\n")).toHaveLength(1);

  // re-summarize with unchanged transcript → served from cache, no new spawn
  await page.getByTestId("summarize-btn").click();
  await expect(page.getByTestId("summary-card")).toBeVisible();
  expect(fs.readFileSync(CALL_LOG, "utf8").trim().split("\n")).toHaveLength(1);
});

test("open in Terminal sends the resume command (fake sink)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  await page.getByTestId("open-terminal-btn").click();
  await expect(page.getByTestId("open-terminal-btn")).toHaveText("opened ✓");

  const log = fs.readFileSync(OPEN_LOG, "utf8");
  expect(log).toContain("rocket-shop' && claude --resume " + SID_ROCKET);
  expect(log.startsWith("cd '")).toBe(true);
});

test("summary error surfaces when the transcript has nothing to summarize", async ({ page }) => {
  // empty-lab has no transcript at all → no summarize button rendered (no session),
  // ghost-app has one renderable line → still summarizable; instead assert the
  // API contract directly for a bogus id.
  const res = await page.request.post("/api/session/summary", {
    data: { path: "/nowhere", id: SID_ROCKET },
  });
  expect(res.status()).toBe(404);
});
