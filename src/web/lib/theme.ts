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

export interface ThemePreview {
  /** page background (can be a CSS gradient) */
  bg: string;
  /** card surface + its border */
  card: string;
  cardBorder: string;
  /** text lines */
  ink: string;
  muted: string;
  /** two accent chips */
  accent1: string;
  accent2: string;
  /** display font stack for the mini title */
  font: string;
  /** hard offset shadow (dopamine) or glow — CSS box-shadow */
  cardShadow: string;
}

export const THEME_META: Record<Theme, { icon: string; label: string; tagline: string; preview: ThemePreview }> = {
  midnight: {
    icon: "◐",
    label: "midnight",
    tagline: "terminal after dark — the original",
    preview: {
      bg: "#0a0d1c",
      card: "rgba(255,255,255,0.05)",
      cardBorder: "rgba(255,255,255,0.12)",
      ink: "#e8ebf7",
      muted: "#9aa3c0",
      accent1: "#a78bfa",
      accent2: "#67e8f9",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "none",
    },
  },
  arcade: {
    icon: "🕹",
    label: "arcade",
    tagline: "soft synthwave — insert coin",
    preview: {
      bg: "linear-gradient(180deg,#140a30,#341b5e)",
      card: "rgba(30,16,58,0.85)",
      cardBorder: "rgba(255,110,199,0.4)",
      ink: "#f3eeff",
      muted: "#b9a8e6",
      accent1: "#ff6ec7",
      accent2: "#5ce8f5",
      font: '"Press Start 2P", monospace',
      cardShadow: "0 0 14px rgba(92,232,245,0.25)",
    },
  },
  dopamine: {
    icon: "🍭",
    label: "dopamine",
    tagline: "neo-brutalist candy — full sugar",
    preview: {
      bg: "#fdf4e7",
      card: "#fffdf8",
      cardBorder: "#1a1023",
      ink: "#1a1023",
      muted: "#6b5a7e",
      accent1: "#ff3d8a",
      accent2: "#0284c7",
      font: '"Bricolage Grotesque", sans-serif',
      cardShadow: "3px 3px 0 rgba(26,16,35,0.9)",
    },
  },
};
