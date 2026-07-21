import { test, expect } from "@playwright/test";

const bodyBg = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const htmlTheme = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.dataset.theme ?? "");

test("default is midnight: no data-theme, dark navy background", async ({ page }) => {
  await page.goto("/");
  expect(await htmlTheme(page)).toBe("");
  await expect(page.getByTestId("theme-toggle")).toContainText("midnight");
  expect(await bodyBg(page)).toBe("rgb(10, 13, 28)"); // #0a0d1c
});

test("theme picker: pick applies live, marks active, persists, closes", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("theme-toggle").click();
  const modal = page.getByTestId("theme-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("theme-option-midnight").getByTestId("theme-active")).toBeVisible();

  // pick arcade → live swap behind the modal
  await modal.getByTestId("theme-option-arcade").click();
  expect(await htmlTheme(page)).toBe("arcade");
  await expect(modal.getByTestId("theme-option-arcade").getByTestId("theme-active")).toBeVisible();
  const vio = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-vio").trim(),
  );
  expect(vio).toBe("#ff6ec7");

  // pick dopamine → light background actually applied
  await modal.getByTestId("theme-option-dopamine").click();
  expect(await htmlTheme(page)).toBe("dopamine");
  expect(await bodyBg(page)).not.toBe("rgb(10, 13, 28)");

  // Esc closes; choice persists on another page + reload
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("theme-modal")).toHaveCount(0);
  await page.getByTestId("stats-link").click();
  await expect(page.getByTestId("kpi-row")).toBeVisible();
  expect(await htmlTheme(page)).toBe("dopamine");
  await page.goto("/");
  expect(await htmlTheme(page)).toBe("dopamine");
  await expect(page.getByTestId("theme-toggle")).toContainText("dopamine");

  // reset to midnight for later specs
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-option-midnight").click();
  await page.keyboard.press("Escape");
});

test("arcade keeps body text readable (Inter, not the pixel font)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-option-arcade").click();
  await page.keyboard.press("Escape");
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(bodyFont).toContain("Inter");
  expect(bodyFont).not.toContain("Press Start");
  // reset
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-option-midnight").click();
  await page.keyboard.press("Escape");
});

test("garbage in localStorage falls back to midnight", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("claudeDeck.theme", "hotdog"));
  await page.goto("/");
  expect(await htmlTheme(page)).toBe("");
  await expect(page.getByTestId("theme-toggle")).toContainText("midnight");
});
