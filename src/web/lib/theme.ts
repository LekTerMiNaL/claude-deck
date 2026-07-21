export const THEMES = [
  "midnight",
  "arcade",
  "dopamine",
  "phosphor",
  "neon-tokyo",
  "dracula",
  "nord",
  "catppuccin",
  "mono",
  "paper",
  "thai",
] as const;
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
  phosphor: {
    icon: "🟢",
    label: "phosphor",
    tagline: "green CRT terminal — 80s glow",
    preview: {
      bg: "#0a1410",
      card: "rgba(125,255,154,0.05)",
      cardBorder: "rgba(125,255,154,0.28)",
      ink: "#86ffa5",
      muted: "#46b06a",
      accent1: "#6bff8f",
      accent2: "#ffcf4a",
      font: '"JetBrains Mono", monospace',
      cardShadow: "0 0 14px rgba(125,255,154,0.2)",
    },
  },
  "neon-tokyo": {
    icon: "⛩",
    label: "neon tokyo",
    tagline: "cyberpunk nights — red & chrome",
    preview: {
      bg: "linear-gradient(180deg,#12071f,#250f3e)",
      card: "rgba(40,15,60,0.75)",
      cardBorder: "rgba(255,46,99,0.4)",
      ink: "#fbe9ff",
      muted: "#c39bd8",
      accent1: "#ff2e63",
      accent2: "#08f7fe",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "0 0 14px rgba(255,46,99,0.25)",
    },
  },
  dracula: {
    icon: "🧛",
    label: "dracula",
    tagline: "the classic dev dark palette",
    preview: {
      bg: "#282a36",
      card: "#313442",
      cardBorder: "rgba(98,114,164,0.4)",
      ink: "#f8f8f2",
      muted: "#bdc0da",
      accent1: "#bd93f9",
      accent2: "#8be9fd",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "none",
    },
  },
  nord: {
    icon: "❄",
    label: "nord",
    tagline: "arctic, muted, calm",
    preview: {
      bg: "#2e3440",
      card: "#3b4252",
      cardBorder: "rgba(136,192,208,0.35)",
      ink: "#eceff4",
      muted: "#b6c0d2",
      accent1: "#88c0d0",
      accent2: "#b48ead",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "none",
    },
  },
  catppuccin: {
    icon: "🐱",
    label: "catppuccin",
    tagline: "mocha — soft pastel dark",
    preview: {
      bg: "#1e1e2e",
      card: "#313244",
      cardBorder: "rgba(137,180,250,0.35)",
      ink: "#cdd6f4",
      muted: "#a6adc8",
      accent1: "#cba6f7",
      accent2: "#89b4fa",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "none",
    },
  },
  mono: {
    icon: "🤍",
    label: "mono",
    tagline: "grayscale — focus mode",
    preview: {
      bg: "#0c0c0c",
      card: "rgba(255,255,255,0.05)",
      cardBorder: "rgba(255,255,255,0.18)",
      ink: "#ededed",
      muted: "#9a9a9a",
      accent1: "#ffffff",
      accent2: "#9a9a9a",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "none",
    },
  },
  paper: {
    icon: "📰",
    label: "paper",
    tagline: "newsprint — light & serif",
    preview: {
      bg: "#f4f1e8",
      card: "#fffef8",
      cardBorder: "rgba(28,26,21,0.35)",
      ink: "#1c1a15",
      muted: "#57534a",
      accent1: "#b23b2e",
      accent2: "#2b5c8a",
      font: '"Lora", serif',
      cardShadow: "none",
    },
  },
  thai: {
    icon: "⛩️",
    label: "thai",
    tagline: "gold, crimson & jade",
    preview: {
      bg: "#fbf3e0",
      card: "#fffdf3",
      cardBorder: "rgba(43,29,18,0.3)",
      ink: "#2b1d12",
      muted: "#6e5a44",
      accent1: "#9e1b32",
      accent2: "#b8860b",
      font: '"Space Grotesk", sans-serif',
      cardShadow: "3px 3px 0 rgba(184,134,11,0.25)",
    },
  },
};
