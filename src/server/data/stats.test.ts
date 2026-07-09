import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { promptsPerDay, capModels, normalizeHourCounts, buildStats, localDate } from "./stats.js";
import { makeWorld, writeHistory, SID, type FixtureWorld } from "./test-helpers.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

const DAY = 86_400_000;

describe("promptsPerDay", () => {
  it("groups by local date, fills gaps, caps the window, counts the all-time total", () => {
    const now = Date.UTC(2026, 6, 10, 12, 0, 0); // fixed reference
    writeHistory(world, [
      { display: "old beyond window", timestamp: now - 40 * DAY, project: "/w/a", sessionId: SID.a1 },
      { display: "two days ago #1", timestamp: now - 2 * DAY, project: "/w/a", sessionId: SID.a1 },
      { display: "two days ago #2", timestamp: now - 2 * DAY + 1000, project: "/w/b", sessionId: SID.b1 },
      { display: "today", timestamp: now, project: "/w/a", sessionId: SID.a1 },
    ]);
    const { perDay, total } = promptsPerDay(7, now);
    expect(perDay).toHaveLength(7);
    expect(total).toBe(4); // all-time, incl. beyond the window
    expect(perDay[6]).toEqual({ date: localDate(now), count: 1 });
    expect(perDay[4]).toEqual({ date: localDate(now - 2 * DAY), count: 2 });
    expect(perDay[5]?.count).toBe(0); // gap filled
  });
});

describe("capModels", () => {
  const day = (date: string, byModel: Record<string, number>) => ({ date, byModel });

  it("keeps ≤4 models untouched, ranked by total", () => {
    const { models } = capModels([day("2026-07-01", { a: 5, b: 10 })]);
    expect(models).toEqual(["b", "a"]);
  });

  it("folds the tail into 'other' past 4 models (never a 5th hue)", () => {
    const { models, perDay } = capModels([
      day("2026-07-01", { a: 100, b: 80, c: 60, d: 40, e: 20, f: 10 }),
    ]);
    expect(models).toEqual(["a", "b", "c", "other"]);
    expect(perDay[0]?.byModel).toEqual({ a: 100, b: 80, c: 60, other: 70 }); // d+e+f
  });
});

describe("normalizeHourCounts", () => {
  it("expands a sparse object to a dense 24 array, ignoring junk", () => {
    const out = normalizeHourCounts({ "1": 5, "23": 2, "24": 9, "-1": 9, x: 9 } as Record<string, number>);
    expect(out).toHaveLength(24);
    expect(out[1]).toBe(5);
    expect(out[23]).toBe(2);
    expect(out.reduce((a, b) => a + b)).toBe(7);
  });
});

describe("buildStats", () => {
  it("tolerates a missing stats-cache and still serves prompts from history", () => {
    const now = Date.now();
    writeHistory(world, [{ display: "p", timestamp: now, project: "/w/a", sessionId: SID.a1 }]);
    const stats = buildStats(now);
    expect(stats.totals).toEqual({ sessions: 0, messages: 0, prompts: 1, toolCalls: 0 });
    expect(stats.promptsPerDay).toHaveLength(30);
    expect(stats.daily).toEqual([]);
    expect(stats.hourCounts).toHaveLength(24);
  });

  it("merges the stats cache when present", () => {
    fs.writeFileSync(
      path.join(world.claudeDir, "stats-cache.json"),
      JSON.stringify({
        totalSessions: 14,
        totalMessages: 45438,
        dailyActivity: [{ date: "2026-07-01", messageCount: 3103, sessionCount: 2, toolCallCount: 1072 }],
        dailyModelTokens: [{ date: "2026-07-01", tokensByModel: { "model-a": 17_000_000 } }],
        hourCounts: { "9": 3 },
      }),
    );
    const stats = buildStats();
    expect(stats.totals.sessions).toBe(14);
    expect(stats.totals.toolCalls).toBe(1072);
    expect(stats.daily[0]).toEqual({ date: "2026-07-01", messages: 3103, tools: 1072 });
    expect(stats.tokens.models).toEqual(["model-a"]);
    expect(stats.hourCounts[9]).toBe(3);
  });
});
