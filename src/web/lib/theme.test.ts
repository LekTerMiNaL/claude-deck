import { describe, it, expect } from "vitest";
import { THEMES, normalizeTheme, nextTheme } from "./theme.js";

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

  it("cycles midnight → arcade → dopamine → midnight", () => {
    expect(nextTheme("midnight")).toBe("arcade");
    expect(nextTheme("arcade")).toBe("dopamine");
    expect(nextTheme("dopamine")).toBe("midnight");
  });
});
