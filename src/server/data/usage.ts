import fs from "node:fs";
import path from "node:path";
import { configDir } from "./paths.js";

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
      resetsAt: typeof win.resets_at === "string" ? win.resets_at : null,
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
