import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDir, claudeDir } from "./paths.js";

export interface UsageWindow {
  key: string;
  /** "5h" | "week" | the raw key for unknown windows. */
  label: string;
  /** 0-100, clamped. */
  usedPercentage: number;
  resetsAt: string | null;
}

export interface UsageInfo {
  /** False when the statusline bridge hasn't written anything yet. */
  configured: boolean;
  updatedAt: number | null;
  model: string | null;
  windows: UsageWindow[];
  /** True when the data is older than STALE_MS (no session running lately). */
  stale: boolean;
}

const STALE_MS = 10 * 60 * 1000;

/**
 * resets_at arrives as unix seconds on this machine (verified live), but the
 * docs-era shape was an ISO string — accept both, plus epoch millis.
 */
function toIso(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    const ms = v > 1e12 ? v : v * 1000;
    return new Date(ms).toISOString();
  }
  return null;
}

function labelFor(key: string): string {
  if (/five|5/.test(key)) return "5h";
  if (/seven|7|week/.test(key)) return "week";
  return key;
}

const LABEL_ORDER: Record<string, number> = { "5h": 0, week: 1 };

/**
 * Normalize the rate_limits object Claude Code hands to statusline scripts.
 * Keys are matched loosely (five_hour/5h → "5h", seven_day/weekly → "week",
 * anything else passes through) so shape drift doesn't break the pill.
 */
export function normalizeRateLimits(raw: unknown): UsageWindow[] {
  if (!raw || typeof raw !== "object") return [];
  const windows: UsageWindow[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const win = value as { used_percentage?: unknown; resets_at?: unknown };
    if (typeof win.used_percentage !== "number" || Number.isNaN(win.used_percentage)) continue;
    windows.push({
      key,
      label: labelFor(key),
      usedPercentage: Math.min(100, Math.max(0, win.used_percentage)),
      resetsAt: toIso(win.resets_at),
    });
  }
  return windows.sort((a, b) => (LABEL_ORDER[a.label] ?? 9) - (LABEL_ORDER[b.label] ?? 9));
}

/** Read what the statusline bridge last persisted. */
export function readUsage(now = Date.now()): UsageInfo {
  const file = path.join(configDir(), "rate-limits.json");
  let raw: { updatedAt?: unknown; model?: unknown; rate_limits?: unknown };
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8")) as typeof raw;
  } catch {
    return { configured: false, updatedAt: null, model: null, windows: [], stale: false };
  }
  const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : null;
  const windows = normalizeRateLimits(raw.rate_limits);
  return {
    configured: windows.length > 0,
    updatedAt,
    model: typeof raw.model === "string" ? raw.model : null,
    windows,
    stale: updatedAt !== null ? now - updatedAt > STALE_MS : true,
  };
}

export interface UsageSetup {
  /** Absolute path to the statusline bridge that feeds the usage bars. */
  bridgePath: string;
  /** Where the user pastes the snippet (never written by the server). */
  settingsPath: string;
  /** The exact JSON block to add to ~/.claude/settings.json. */
  snippet: string;
}

/** Absolute path to scripts/statusline-bridge.mjs (package root, dev + npx). */
export function bridgePath(): string {
  // this module: <root>/src/server/data/usage.ts (dev) or
  //              <root>/dist/server/data/usage.js (prod) — up 3 = package root
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..", "scripts", "statusline-bridge.mjs");
}

/** Paths + copy-paste snippet for turning the usage bars on. Read-only. */
export function usageSetup(): UsageSetup {
  const bp = bridgePath();
  const snippet = `"statusLine": {\n  "type": "command",\n  "command": "node ${bp}"\n}`;
  return { bridgePath: bp, settingsPath: path.join(claudeDir(), "settings.json"), snippet };
}
