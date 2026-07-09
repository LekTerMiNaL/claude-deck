import { test, expect } from "@playwright/test";

// Self-sufficient — hits /search directly, no deck state needed.
// Fixture history: 2 rocket prompts, 1 moon prompt, 1 ghost prompt.

test("search finds a prompt, highlights the match and deep-links to the session", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByTestId("search-hint")).toBeVisible();

  await page.getByTestId("search-input").fill("moon");
  const rows = page.getByTestId("search-row");
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("search-count")).toContainText("1 match");
  await expect(rows.first()).toContainText("write a post about moon dust");
  await expect(rows.first().getByRole("button", { name: "moon-blog" })).toBeVisible();
  await expect(rows.first().getByTestId("search-hit").first()).toHaveText("moon");

  await rows.first().getByRole("button", { name: "open ↗" }).click();
  await expect(page.getByTestId("thread")).toContainText("regolith static cling");
});

test("matches are case-insensitive and span multiple prompts of a project", async ({ page }) => {
  await page.goto("/search");
  await page.getByTestId("search-input").fill("ROCKET");
  const rows = page.getByTestId("search-row");
  await expect(rows).toHaveCount(1); // only "fix rocket engine overheating bug" contains 'rocket'
  await expect(rows.first()).toContainText("fix rocket engine overheating bug");

  // substring across projects: "ost" hits moon's "post" and ghost-app's "ghost"
  await page.getByTestId("search-input").fill("ost");
  const multi = page.getByTestId("search-row");
  await expect(multi).toHaveCount(2);
  await expect(multi.filter({ hasText: "moon dust" })).toHaveCount(1);
  await expect(multi.filter({ hasText: "ghost experiment" })).toHaveCount(1);
});

test("no matches shows an empty state", async ({ page }) => {
  await page.goto("/search");
  await page.getByTestId("search-input").fill("zzz-nothing-here");
  await expect(page.getByTestId("search-empty")).toBeVisible();
  await expect(page.getByTestId("search-row")).toHaveCount(0);
});

test("query lives in the URL and survives reload", async ({ page }) => {
  await page.goto("/search");
  await page.getByTestId("search-input").fill("ghost");
  await expect(page.getByTestId("search-row")).toHaveCount(1);
  await expect(page).toHaveURL(/\/search\?q=ghost/);

  await page.reload();
  await expect(page.getByTestId("search-input")).toHaveValue("ghost");
  await expect(page.getByTestId("search-row")).toHaveCount(1);
  await expect(page.getByTestId("search-row").first()).toContainText("old ghost experiment");
});

test("dashboard header links to search", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("search-link").click();
  await expect(page.getByTestId("search-input")).toBeVisible();
});
