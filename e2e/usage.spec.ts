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
  // 81% → amber (warn token), 34% → cyan
  await expect(page.getByTestId("usage-week")).toHaveClass(/text-warn/);
  await expect(page.getByTestId("usage-5h")).toHaveClass(/text-cyan/);
  await expect(pill).not.toContainText("stale");
});

test("clicking the pill expands an inline detail panel; clicking again hides it", async ({ page }) => {
  writeUsage({ updatedAt: Date.now() });
  await page.goto("/");

  await expect(page.getByTestId("usage-panel")).toHaveCount(0);
  await page.getByTestId("usage-pill").click();

  const panel = page.getByTestId("usage-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("usage-detail-5h")).toContainText("5-hour session");
  await expect(panel.getByTestId("usage-detail-5h")).toContainText("34%");
  await expect(panel.getByTestId("usage-detail-week")).toContainText("weekly");
  await expect(panel.getByTestId("usage-detail-week")).toContainText("81%");
  await expect(panel).toContainText("resets");
  await expect(panel).toContainText("statusline bridge");

  await page.getByTestId("usage-panel-close").click();
  await expect(page.getByTestId("usage-panel")).toHaveCount(0);
});

test("old data is marked stale", async ({ page }) => {
  writeUsage({ updatedAt: Date.now() - 30 * 60_000 });
  await page.goto("/");
  await expect(page.getByTestId("usage-pill")).toContainText("stale");
});

test("no bridge file → setup hint instead of a silent-nothing", async ({ page }) => {
  fs.rmSync(FILE, { force: true });
  await page.goto("/");
  await expect(page.getByTestId("live-pill")).toBeVisible(); // page loaded
  await expect(page.getByTestId("usage-pill")).toHaveCount(0);

  const hint = page.getByTestId("usage-setup-hint");
  await expect(hint).toBeVisible();
  await hint.getByText("set up usage bars").click();

  const panel = page.getByTestId("usage-setup-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("statusLine");
  await expect(panel).toContainText("setup-statusline"); // the CLI shortcut is mentioned
  await expect(panel.getByTestId("usage-setup-copy")).toBeVisible();
});

test("dismissing the hint hides it and remembers across reload", async ({ page }) => {
  fs.rmSync(FILE, { force: true });
  await page.goto("/");
  await page.getByTestId("usage-hint-dismiss").click();
  await expect(page.getByTestId("usage-setup-hint")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("live-pill")).toBeVisible();
  await expect(page.getByTestId("usage-setup-hint")).toHaveCount(0); // localStorage remembered
});

test("once the bridge file exists, the hint is gone and the pill is back", async ({ page }) => {
  writeUsage({ updatedAt: Date.now() });
  await page.goto("/");
  await expect(page.getByTestId("usage-pill")).toBeVisible();
  await expect(page.getByTestId("usage-setup-hint")).toHaveCount(0);
});
