import { test, expect } from "@playwright/test";

// "regolith" exists ONLY inside the moon transcript (assistant text) — it was
// never typed as a prompt, so it cleanly separates the two search modes.

test("prompts mode misses transcript-only text; full text finds it", async ({ page }) => {
  await page.goto("/search");
  await page.getByTestId("search-input").fill("regolith");
  await expect(page.getByTestId("search-empty")).toBeVisible(); // not in any prompt

  await page.getByTestId("mode-deep").click();
  const rows = page.getByTestId("deep-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByTestId("deep-role")).toHaveText("✦"); // claude said it
  await expect(rows.first()).toContainText("regolith static cling");
  await expect(rows.first().getByTestId("search-hit").first()).toHaveText(/regolith/i);
});

test("deep result deep-links into the session", async ({ page }) => {
  await page.goto("/search?q=regolith&mode=deep");
  const row = page.getByTestId("deep-row").first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "open ↗" }).click();
  await expect(page.getByTestId("session-head")).toContainText("moon-blog-2");
});

test("mode + query survive reload via the URL", async ({ page }) => {
  await page.goto("/search");
  await page.getByTestId("search-input").fill("checkout");
  await page.getByTestId("mode-deep").click();
  await expect(page.getByTestId("deep-row").first()).toBeVisible();
  await expect(page).toHaveURL(/mode=deep/);

  await page.reload();
  await expect(page.getByTestId("search-input")).toHaveValue("checkout");
  await expect(page.getByTestId("deep-row").first()).toBeVisible();
});

test("deep search matches user prompts inside transcripts too", async ({ page }) => {
  await page.goto("/search?q=overheating&mode=deep");
  const rows = page.getByTestId("deep-row");
  await expect(rows.first()).toBeVisible();
  // both the user turn and the rocket transcript context can hit — role marker distinguishes
  await expect(rows.filter({ hasText: "fix rocket engine overheating bug" }).first().getByTestId("deep-role")).toHaveText("❯");
});
