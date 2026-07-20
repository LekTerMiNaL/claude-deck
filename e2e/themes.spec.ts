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

test("cycling switches skin for real and persists across pages + reload", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByTestId("theme-toggle");

  // → arcade: purple sky, tokens swapped
  await toggle.click();
  expect(await htmlTheme(page)).toBe("arcade");
  await expect(toggle).toContainText("arcade");
  const arcadeInk = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-vio").trim(),
  );
  expect(arcadeInk).toBe("#ff6ec7");

  // → dopamine: light cream background actually applied
  await toggle.click();
  expect(await htmlTheme(page)).toBe("dopamine");
  const bg = await bodyBg(page);
  expect(bg).not.toBe("rgb(10, 13, 28)");

  // persists on another page and across reload
  await page.getByTestId("stats-link").click();
  await expect(page.getByTestId("kpi-row")).toBeVisible();
  expect(await htmlTheme(page)).toBe("dopamine");
  await page.goto("/");
  expect(await htmlTheme(page)).toBe("dopamine");

  // → back to midnight
  await page.getByTestId("theme-toggle").click();
  expect(await htmlTheme(page)).toBe("");
  expect(await bodyBg(page)).toBe("rgb(10, 13, 28)");
});

test("garbage in localStorage falls back to midnight", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("claudeDeck.theme", "hotdog"));
  await page.goto("/");
  expect(await htmlTheme(page)).toBe("");
  await expect(page.getByTestId("theme-toggle")).toContainText("midnight");
});
