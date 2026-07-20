export const THEMES = ["midnight", "arcade", "dopamine"] as const;
export type Theme = (typeof THEMES)[number];

const STORE_KEY = "claudeDeck.theme";

export function normalizeTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "midnight";
}

export function savedTheme(): Theme {
  try {
    return normalizeTheme(localStorage.getItem(STORE_KEY));
  } catch {
    return "midnight";
  }
}

export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]!;
}

/** Stamp the theme on <html>. Midnight = no attribute (the default tokens). */
export function applyTheme(theme: Theme): void {
  if (theme === "midnight") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORE_KEY, theme);
  } catch {
    // storage unavailable — theme just won't persist
  }
}

export const THEME_META: Record<Theme, { icon: string; label: string }> = {
  midnight: { icon: "◐", label: "midnight" },
  arcade: { icon: "🕹", label: "arcade" },
  dopamine: { icon: "🍭", label: "dopamine" },
};
