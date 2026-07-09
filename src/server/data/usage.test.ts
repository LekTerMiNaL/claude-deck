import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { normalizeRateLimits, readUsage } from "./usage.js";
import { makeWorld, type FixtureWorld } from "./test-helpers.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

describe("normalizeRateLimits", () => {
  it("maps five_hour/seven_day shapes with loose key matching, 5h first", () => {
    const windows = normalizeRateLimits({
      seven_day: { used_percentage: 81.4, resets_at: "2026-07-14T00:00:00Z" },
      five_hour: { used_percentage: 34, resets_at: "2026-07-10T05:00:00Z" },
    });
    expect(windows.map((w) => w.label)).toEqual(["5h", "week"]);
    expect(windows[0]).toMatchObject({ key: "five_hour", usedPercentage: 34 });
    expect(windows[1]).toMatchObject({ usedPercentage: 81.4, resetsAt: "2026-07-14T00:00:00Z" });
  });

  it("passes unknown keys through and clamps percentages", () => {
    const windows = normalizeRateLimits({
      opus_quota: { used_percentage: 120 },
      weekly: { used_percentage: -5 },
    });
    expect(windows.map((w) => [w.label, w.usedPercentage])).toEqual([
      ["week", 0],
      ["opus_quota", 100],
    ]);
  });

  it("accepts resets_at as unix seconds, epoch millis or ISO string", () => {
    const windows = normalizeRateLimits({
      five_hour: { used_percentage: 50, resets_at: 1783637400 }, // seconds (real shape)
      seven_day: { used_percentage: 5, resets_at: 1783637400000 }, // millis
      other: { used_percentage: 1, resets_at: "2026-07-14T00:00:00Z" }, // ISO
      bad: { used_percentage: 2, resets_at: { nested: true } },
    });
    expect(windows.find((w) => w.key === "five_hour")?.resetsAt).toBe("2026-07-09T22:50:00.000Z");
    expect(windows.find((w) => w.key === "seven_day")?.resetsAt).toBe("2026-07-09T22:50:00.000Z");
    expect(windows.find((w) => w.key === "other")?.resetsAt).toBe("2026-07-14T00:00:00Z");
    expect(windows.find((w) => w.key === "bad")?.resetsAt).toBeNull();
  });

  it("drops junk: non-numeric, missing used_percentage, non-object input", () => {
    expect(normalizeRateLimits(null)).toEqual([]);
    expect(normalizeRateLimits("x")).toEqual([]);
    expect(normalizeRateLimits({ a: { used_percentage: "50" }, b: null, c: {} })).toEqual([]);
  });
});

describe("readUsage", () => {
  const file = () => path.join(world.configDir, "rate-limits.json");
  const write = (o: object) => {
    fs.mkdirSync(world.configDir, { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(o));
  };

  it("configured=false when the bridge never ran (or file is malformed)", () => {
    expect(readUsage().configured).toBe(false);
    fs.mkdirSync(world.configDir, { recursive: true });
    fs.writeFileSync(file(), "not json");
    expect(readUsage().configured).toBe(false);
  });

  it("fresh vs stale via updatedAt", () => {
    const now = 1_000_000_000_000;
    write({ updatedAt: now - 60_000, model: "Opus", rate_limits: { five_hour: { used_percentage: 10 } } });
    const fresh = readUsage(now);
    expect(fresh).toMatchObject({ configured: true, stale: false, model: "Opus" });
    expect(fresh.windows[0]?.label).toBe("5h");

    write({ updatedAt: now - 11 * 60_000, rate_limits: { five_hour: { used_percentage: 10 } } });
    expect(readUsage(now).stale).toBe(true);
  });

  it("rate_limits with no usable windows is treated as not configured", () => {
    write({ updatedAt: Date.now(), rate_limits: null });
    expect(readUsage().configured).toBe(false);
  });
});

describe("statusline-bridge.mjs (real child process)", () => {
  const BRIDGE = path.resolve("scripts/statusline-bridge.mjs");
  const run = (stdin: string) =>
    execFileSync("node", [BRIDGE], {
      input: stdin,
      env: { ...process.env, CLAUDE_DECK_CONFIG_DIR: world.configDir },
      encoding: "utf8",
    });

  it("persists rate_limits to the config dir and prints a compact line", () => {
    const out = run(
      JSON.stringify({
        model: { display_name: "Opus 4.8" },
        rate_limits: {
          five_hour: { used_percentage: 34.6, resets_at: "2026-07-10T05:00:00Z" },
          seven_day: { used_percentage: 81, resets_at: "2026-07-14T00:00:00Z" },
        },
      }),
    );
    expect(out.trim()).toBe("Opus 4.8 · 5h 35% · wk 81%");
    const saved = JSON.parse(fs.readFileSync(path.join(world.configDir, "rate-limits.json"), "utf8"));
    expect(saved.model).toBe("Opus 4.8");
    expect(saved.rate_limits.seven_day.used_percentage).toBe(81);
    expect(typeof saved.updatedAt).toBe("number");
  });

  it("never breaks on garbage stdin — still prints and exits 0", () => {
    const out = run("{{{not json");
    expect(out.trim()).toBe("claude");
  });
});
