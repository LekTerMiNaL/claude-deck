import { describe, it, expect } from "vitest";
import { THEMES, normalizeTheme, THEME_META } from "./theme.js";

describe("theme", () => {
  it("has midnight first (the default)", () => {
    expect(THEMES[0]).toBe("midnight");
  });

  it("normalizes unknown/legacy values to midnight", () => {
    expect(normalizeTheme("arcade")).toBe("arcade");
    expect(normalizeTheme("dopamine")).toBe("dopamine");
    expect(normalizeTheme("neon")).toBe("midnight");
    expect(normalizeTheme(null)).toBe("midnight");
    expect(normalizeTheme(undefined)).toBe("midnight");
    expect(normalizeTheme(42)).toBe("midnight");
  });

  it("carries preview colors + a tagline for every theme (the picker needs them)", () => {
    for (const t of THEMES) {
      const meta = THEME_META[t];
      expect(meta.icon).toBeTruthy();
      expect(meta.tagline).toBeTruthy();
      expect(meta.preview.bg).toBeTruthy();
      expect(meta.preview.accent1).toMatch(/^#|gradient|rgb/);
      expect(meta.preview.font).toBeTruthy();
    }
  });
});
