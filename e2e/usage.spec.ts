import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("e2e/.tmp-config/rate-limits.json");

function writeUsage(opts: { updatedAt: number }) {
  fs.writeFileSync(
    FILE,
    JSON.stringify({
      updatedAt: opts.updatedAt,
      model: "Fixture Model",
      rate_limits: {
        five_hour: { used_percentage: 34, resets_at: "2026-07-10T05:00:00Z" },
        seven_day: { used_percentage: 81, resets_at: "2026-07-14T00:00:00Z" },
      },
    }),
  );
}

test.afterEach(() => writeUsage({ updatedAt: Date.now() })); // restore fresh state

test("usage pill shows 5h + week windows with the right tones", async ({ page }) => {
  writeUsage({ updatedAt: Date.now() });
  await page.goto("/");

  const pill = page.getByTestId("usage-pill");
  await expect(pill).toBeVisible();
  await expect(page.getByTestId("usage-5h")).toContainText("34%");
  await expect(page.getByTestId("usage-week")).toContainText("81%");
  // 81% → amber, 34% → cyan
  await expect(page.getByTestId("usage-week")).toHaveClass(/fbbf24/);
  await expect(page.getByTestId("usage-5h")).toHaveClass(/text-cyan/);
  await expect(pill).not.toContainText("stale");
});

test("old data is marked stale", async ({ page }) => {
  writeUsage({ updatedAt: Date.now() - 30 * 60_000 });
  await page.goto("/");
  await expect(page.getByTestId("usage-pill")).toContainText("stale");
});

test("no bridge file → no pill", async ({ page }) => {
  fs.rmSync(FILE, { force: true });
  await page.goto("/");
  await expect(page.getByTestId("live-pill")).toBeVisible(); // page loaded
  await expect(page.getByTestId("usage-pill")).toHaveCount(0);
});
