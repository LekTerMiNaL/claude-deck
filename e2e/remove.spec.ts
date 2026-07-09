import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// Runs after dashboard.spec.ts (workers=1, alphabetical: d < r), which left the
// deck with rocket-shop, moon-blog, empty-lab and ghost-app + the workspace
// root registered. This spec only consumes state no later spec depends on:
// the ghost-app deck entry and a temp root it creates itself.

const TEMP_ROOT = path.resolve("e2e/fixtures/temp-root");

test("✕ arms first, removes on the second click, and survives reload", async ({ page }) => {
  await page.goto("/");
  const ghost = page.getByTestId("deck-card").filter({ hasText: "ghost-app" });
  await expect(ghost).toHaveCount(1);

  // first click only arms
  await ghost.getByTestId("remove-project").click();
  await expect(ghost.getByTestId("remove-project")).toHaveText("sure?");
  await page.reload();
  await expect(page.getByTestId("deck-card").filter({ hasText: "ghost-app" })).toHaveCount(1);

  // arm + confirm removes; the config change survives reload
  const ghost2 = page.getByTestId("deck-card").filter({ hasText: "ghost-app" });
  await ghost2.getByTestId("remove-project").click();
  await ghost2.getByTestId("remove-project").click();
  await expect(page.getByTestId("deck-card").filter({ hasText: "ghost-app" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("deck-card").filter({ hasText: "ghost-app" })).toHaveCount(0);
  // other cards untouched
  await expect(page.getByTestId("deck-card").filter({ hasText: "rocket-shop" })).toHaveCount(1);
});

test("unregistering a root hides its children but keeps added projects", async ({ page }) => {
  fs.mkdirSync(path.join(TEMP_ROOT, "loose-end"), { recursive: true });

  await page.goto("/");
  await page.getByRole("button", { name: "+ Add project", exact: true }).click();
  await page.getByTestId("path-input").fill(TEMP_ROOT);
  await page.getByTestId("add-root-btn").click();

  const chip = page.getByTestId("root-chip").filter({ hasText: "temp-root" });
  await expect(chip).toBeVisible();
  await expect(page.getByTestId("root-child-row").filter({ hasText: "loose-end" })).toHaveCount(1);

  // arm + confirm on the root chip
  await chip.getByTestId("remove-root").click();
  await expect(chip.getByTestId("remove-root")).toHaveText("sure?");
  await chip.getByTestId("remove-root").click();

  await expect(page.getByTestId("root-chip").filter({ hasText: "temp-root" })).toHaveCount(0);
  await expect(page.getByTestId("root-child-row").filter({ hasText: "loose-end" })).toHaveCount(0);
  // deck projects previously added via other roots are untouched
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("deck-card").filter({ hasText: "empty-lab" })).toHaveCount(1);
});
