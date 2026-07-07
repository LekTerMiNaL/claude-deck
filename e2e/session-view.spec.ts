import { test, expect } from "@playwright/test";

// Runs after dashboard.spec.ts (alphabetical, workers=1), so the deck already
// contains rocket-shop, moon-blog, empty-lab and ghost-app.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const SID_ROCKET = "11111111-aaaa-4aaa-8aaa-111111111111";

test("deck card opens the session view with sessions sorted live-first", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  await expect(page.getByTestId("crumb")).toContainText("deck / rocket-shop");
  const items = page.getByTestId("session-item");
  await expect(items).toHaveCount(2);
  // live session first, titled by its live name; second titled by ai-title
  await expect(items.nth(0)).toContainText("rocket-shop-7");
  await expect(items.nth(1)).toContainText("Prototype landing legs");
});

test("thread renders text turns + tool chips and skips noise lines", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  const thread = page.getByTestId("thread");
  await expect(thread.getByTestId("msg-user")).toHaveCount(2);
  await expect(thread.getByTestId("msg-assistant")).toHaveCount(2);
  await expect(thread).toContainText("build the checkout page");
  await expect(thread).toContainText("Coolant loop was saturating");
  // tool chips
  await expect(thread).toContainText("Read");
  await expect(thread).toContainText("Edit");
  await expect(thread).toContainText("Bash");
  // skipped noise never renders
  await expect(thread).not.toContainText("subagent noise");
  await expect(thread).not.toContainText("tool_result");
});

test("header card shows status, meta and copies the full resume command", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  const head = page.getByTestId("session-head");
  await expect(head).toContainText("busy");
  await expect(head).toContainText("rocket-shop-7");
  await expect(head).toContainText("2 prompts");
  await expect(page.getByTestId("resume-cmd")).toContainText("claude --resume 1111…111");

  await page.getByTestId("copy-btn").click();
  await expect(page.getByTestId("copy-btn")).toHaveText("copied ✓");
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("claude --resume " + SID_ROCKET);
  expect(clip).toMatch(/^cd .*rocket-shop && claude --resume/);
});

test("switching sessions in the sidebar swaps the thread", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "rocket-shop" }).click();

  await page.getByTestId("session-item").filter({ hasText: "Prototype landing legs" }).click();
  await expect(page.getByTestId("thread")).toContainText("prototype the landing legs");
  await expect(page.getByTestId("session-head")).toContainText("Prototype landing legs");
  // no live status on this one
  await expect(page.getByTestId("session-head")).not.toContainText("busy");
});

test("live card open ↗ deep-links to the right session", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("live-card")
    .filter({ hasText: "moon-blog-2" })
    .getByTestId("live-open")
    .click();

  await expect(page.getByTestId("crumb")).toContainText("moon-blog");
  await expect(page.getByTestId("session-head")).toContainText("moon-blog-2");
  await expect(page.getByTestId("thread")).toContainText("regolith static cling");
});

test("project without transcripts shows a friendly empty state", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "empty-lab" }).click();
  await expect(page.getByTestId("no-sessions")).toBeVisible();
  await expect(page.getByTestId("no-session")).toContainText("no transcript found for empty-lab");
});

test("browser back returns to the dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("deck-card").filter({ hasText: "moon-blog" }).click();
  await expect(page.getByTestId("crumb")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("live-pill")).toBeVisible();
});
