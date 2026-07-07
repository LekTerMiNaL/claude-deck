import { test, expect } from "@playwright/test";
import path from "node:path";

const WORKSPACE = path.resolve("e2e/fixtures/workspace");

// Specs run in order against one server + one config dir: the deck starts
// empty and fills up as the suite walks through the add-project flows.
test.describe.configure({ mode: "serial" });

test("empty deck: live sessions visible, deck empty state, dead pid dropped", async ({ page }) => {
  await page.goto("/");

  // pill counts busy sessions only (rocket busy; moon idle; 999999 dead)
  await expect(page.getByTestId("live-pill")).toHaveText(/1 session running/);

  const liveCards = page.getByTestId("live-card");
  await expect(liveCards).toHaveCount(2);
  await expect(liveCards.filter({ hasText: "rocket-shop-7" })).toContainText("busy");
  await expect(liveCards.filter({ hasText: "rocket-shop-7" })).toContainText("fix rocket engine overheating bug");
  await expect(liveCards.filter({ hasText: "moon-blog-2" })).toContainText("idle");
  await expect(page.getByText("dead-one")).toHaveCount(0);

  // deck is empty until the user adds projects
  await expect(page.getByTestId("deck-card")).toHaveCount(0);
  await expect(page.getByTestId("add-card")).toContainText("your deck is empty");
});

test("scan modal lists projects by last activity and marks the orphan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();
  const modal = page.getByTestId("add-modal");
  await expect(modal).toBeVisible();

  const rows = page.getByTestId("scan-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("rocket-shop"); // most recent first
  await expect(rows.nth(0)).toContainText("● live now");
  await expect(rows.nth(1)).toContainText("moon-blog");
  await expect(rows.nth(2)).toContainText("ghost-app");
  await expect(rows.nth(2)).toContainText("⚠ folder missing — history only");

  // filter box narrows the list
  await page.getByTestId("filter-input").fill("moon");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("moon-blog");
});

test("add from scanned list → deck card with stats + in-deck mark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();

  const rocketRow = page.getByTestId("scan-row").filter({ hasText: "rocket-shop" });
  await rocketRow.getByRole("button", { name: "+ Add" }).click();
  await expect(rocketRow.getByText("✓ in deck")).toBeVisible();

  await page.keyboard.press("Escape");
  const card = page.getByTestId("deck-card").filter({ hasText: "rocket-shop" });
  await expect(card).toContainText("sessions 2");
  await expect(card).toContainText("prompts 2");
  await expect(card).toContainText("● 1 live");
  await expect(card).toContainText("fix rocket engine overheating bug");
});

test("paste a project path adds it; junk path shows an error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();

  await page.getByTestId("path-input").fill("/definitely/not/a/real/folder");
  await page.getByTestId("add-path-btn").click();
  await expect(page.getByTestId("modal-error")).toContainText("folder not found");

  await page.getByTestId("path-input").fill(path.join(WORKSPACE, "moon-blog"));
  await page.getByTestId("add-path-btn").click();
  await expect(page.getByTestId("scan-row").filter({ hasText: "moon-blog" }).getByText("✓ in deck")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-card")).toHaveCount(2);
});

test("register a root folder → history-less subfolder becomes addable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();

  await page.getByTestId("path-input").fill(WORKSPACE);
  await page.getByTestId("add-root-btn").click();

  // empty-lab has no claude history — only reachable via the registered root
  const labRow = page.getByTestId("root-child-row").filter({ hasText: "empty-lab" });
  await expect(labRow).toContainText("no history");
  await labRow.getByRole("button", { name: "+ Add" }).click();
  await expect(labRow.getByText("✓ in deck")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-card").filter({ hasText: "empty-lab" })).toBeVisible();
  await expect(page.getByTestId("deck-card")).toHaveCount(3);
});

test("orphan (history-only) project can still be added and shows a warning", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();

  const ghostRow = page.getByTestId("scan-row").filter({ hasText: "ghost-app" });
  await ghostRow.getByRole("button", { name: "+ Add" }).click();
  await expect(ghostRow.getByText("✓ in deck")).toBeVisible();

  await page.keyboard.press("Escape");
  const card = page.getByTestId("deck-card").filter({ hasText: "ghost-app" });
  await expect(card).toContainText("⚠ folder missing");
});
