import fs from "node:fs";
import path from "node:path";
import { claudeDir } from "./paths.js";
import { historyEntries } from "./timeline.js";

export interface DayCount {
  date: string; // YYYY-MM-DD, local time
  count: number;
}

export interface DailyActivity {
  date: string;
  messages: number;
  tools: number;
}

export interface TokensPerDay {
  date: string;
  byModel: Record<string, number>;
}

export interface StatsPayload {
  totals: { sessions: number; messages: number; prompts: number; toolCalls: number };
  promptsPerDay: DayCount[];
  daily: DailyActivity[];
  tokens: { models: string[]; perDay: TokensPerDay[] };
  hourCounts: number[];
}

const MAX_MODELS = 4;
const OTHER = "other";

interface RawStatsCache {
  dailyActivity?: { date?: string; messageCount?: number; sessionCount?: number; toolCallCount?: number }[];
  dailyModelTokens?: { date?: string; tokensByModel?: Record<string, number> }[];
  totalSessions?: number;
  totalMessages?: number;
  hourCounts?: Record<string, number>;
}

/** Tolerant read of Claude Code's own stats cache. Missing file → empty shape. */
export function readStatsCache(): RawStatsCache {
  try {
    return JSON.parse(fs.readFileSync(path.join(claudeDir(), "stats-cache.json"), "utf8")) as RawStatsCache;
  } catch {
    return {};
  }
}

export function localDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Prompts per local day for the last `days` days (gaps filled) + all-time total. */
export function promptsPerDay(days = 30, now = Date.now()): { perDay: DayCount[]; total: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of historyEntries({ limit: Number.MAX_SAFE_INTEGER }).entries) {
    total++;
    const date = localDate(e.ts);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const perDay: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = localDate(now - i * 86_400_000);
    perDay.push({ date, count: counts.get(date) ?? 0 });
  }
  return { perDay, total };
}

/**
 * Cap the model list at MAX_MODELS by total tokens desc; the tail folds into
 * "other" (fixed slot order downstream — never generate more hues).
 */
export function capModels(perDay: TokensPerDay[]): { models: string[]; perDay: TokensPerDay[] } {
  const totals = new Map<string, number>();
  for (const day of perDay) {
    for (const [model, tokens] of Object.entries(day.byModel)) {
      totals.set(model, (totals.get(model) ?? 0) + tokens);
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  if (ranked.length <= MAX_MODELS) return { models: ranked, perDay };

  const keep = ranked.slice(0, MAX_MODELS - 1);
  const models = [...keep, OTHER];
  return {
    models,
    perDay: perDay.map((day) => {
      const byModel: Record<string, number> = {};
      let other = 0;
      for (const [model, tokens] of Object.entries(day.byModel)) {
        if (keep.includes(model)) byModel[model] = tokens;
        else other += tokens;
      }
      if (other > 0) byModel[OTHER] = other;
      return { date: day.date, byModel };
    }),
  };
}

/** Sparse {"0": n, …} → dense 24-slot array. */
export function normalizeHourCounts(raw: Record<string, number> | undefined): number[] {
  const out = new Array<number>(24).fill(0);
  for (const [k, v] of Object.entries(raw ?? {})) {
    const h = Number(k);
    if (Number.isInteger(h) && h >= 0 && h < 24 && typeof v === "number") out[h] = v;
  }
  return out;
}

export function buildStats(now = Date.now()): StatsPayload {
  const cache = readStatsCache();
  const prompts = promptsPerDay(30, now);

  const daily: DailyActivity[] = (cache.dailyActivity ?? [])
    .filter((d) => typeof d.date === "string")
    .map((d) => ({ date: d.date!, messages: d.messageCount ?? 0, tools: d.toolCallCount ?? 0 }));

  const rawTokens: TokensPerDay[] = (cache.dailyModelTokens ?? [])
    .filter((d) => typeof d.date === "string" && d.tokensByModel)
    .map((d) => ({ date: d.date!, byModel: d.tokensByModel! }));

  return {
    totals: {
      sessions: cache.totalSessions ?? 0,
      messages: cache.totalMessages ?? 0,
      prompts: prompts.total,
      toolCalls: daily.reduce((n, d) => n + d.tools, 0),
    },
    promptsPerDay: prompts.perDay,
    daily,
    tokens: capModels(rawTokens),
    hourCounts: normalizeHourCounts(cache.hourCounts),
  };
}
