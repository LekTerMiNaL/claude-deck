import { test, expect } from "@playwright/test";

test("stats page shows KPI tiles from history + stats cache", async ({ page }) => {
  await page.goto("/stats");

  const tiles = page.getByTestId("stat-tile");
  await expect(tiles).toHaveCount(4);
  await expect(tiles.filter({ hasText: "sessions" })).toContainText("14");
  await expect(tiles.filter({ hasText: "messages" })).toContainText("45,438");
  await expect(tiles.filter({ hasText: "prompts typed" })).toContainText("4"); // fixture history lines
  await expect(tiles.filter({ hasText: "tool calls" })).toContainText("1,072");
});

test("charts render with legend for multi-series and tooltips on hover", async ({ page }) => {
  await page.goto("/stats");

  const cards = page.getByTestId("chart-card");
  await expect(cards).toHaveCount(5); // prompts, messages, tools, tokens, hours

  // tokens chart: 2 models → legend present (identity never color-alone)
  const tokens = cards.filter({ hasText: "tokens / day" });
  await expect(tokens.getByTestId("chart-legend")).toContainText("opus-4-8");
  await expect(tokens.getByTestId("chart-legend")).toContainText("fable-5");

  // single-series charts carry no legend box — the title names the series
  const prompts = cards.filter({ hasText: "prompts / day" });
  await expect(prompts.getByTestId("chart-legend")).toHaveCount(0);

  // hovering a column shows the tooltip with the value
  await tokens.getByTestId("chart-hit").last().hover();
  await expect(tokens.getByTestId("chart-tooltip")).toContainText("17.2M");
});

test("table toggle swaps every chart to its table twin", async ({ page }) => {
  await page.goto("/stats");

  const tokens = page.getByTestId("chart-card").filter({ hasText: "tokens / day" });
  await tokens.getByTestId("table-toggle").click();
  const table = tokens.getByTestId("chart-table");
  await expect(table).toBeVisible();
  await expect(table).toContainText("17,228,039"); // exact value, not compacted
  await expect(table).toContainText("3,105,574");

  await tokens.getByTestId("table-toggle").click(); // back to the chart
  await expect(tokens.getByTestId("chart-table")).toHaveCount(0);
});

test("dashboard header links to stats", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("stats-link").click();
  await expect(page.getByTestId("kpi-row")).toBeVisible();
});
