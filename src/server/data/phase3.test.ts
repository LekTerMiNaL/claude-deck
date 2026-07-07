import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCachedSummary, cacheSummary, buildSummaryInput, summaryPrompt } from "./summary.js";
import { shellQuote, resumeCommand, openTerminalScript } from "./terminal.js";
import { timeline } from "./timeline.js";
import { addProject } from "./config.js";
import { makeWorld, writeHistory, SID, type FixtureWorld } from "./test-helpers.js";
import type { ThreadMessage } from "./transcripts.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

const msg = (role: "user" | "assistant", text: string, tools: string[] = []): ThreadMessage => ({
  role,
  text,
  tools,
  ts: null,
});

describe("summary cache", () => {
  it("round-trips and invalidates when transcript size changes", () => {
    expect(getCachedSummary(SID.a1, 100)).toBeNull();
    cacheSummary({ sessionId: SID.a1, summary: "did stuff", transcriptSize: 100, createdAt: 1 });
    expect(getCachedSummary(SID.a1, 100)?.summary).toBe("did stuff");
    expect(getCachedSummary(SID.a1, 200)).toBeNull(); // transcript grew → stale
  });
});

describe("buildSummaryInput", () => {
  it("labels roles, appends tool names and truncates long messages", () => {
    const input = buildSummaryInput([
      msg("user", "fix it"),
      msg("assistant", "x".repeat(500), ["Bash", "Edit"]),
    ]);
    expect(input).toContain("USER: fix it");
    expect(input).toContain("[tools: Bash, Edit]");
    expect(input).toContain("x".repeat(400) + "…");
    expect(input).not.toContain("x".repeat(401));
  });

  it("keeps only the last 40 messages", () => {
    const input = buildSummaryInput(Array.from({ length: 50 }, (_, i) => msg("user", `m${i}`)));
    expect(input).not.toContain("USER: m9\n");
    expect(input).toContain("USER: m49");
    expect(input.split("\n")).toHaveLength(40);
  });

  it("prompt asks for Thai and embeds the excerpt", () => {
    const p = summaryPrompt("rocket", "USER: hi");
    expect(p).toContain('"rocket"');
    expect(p).toContain("Thai");
    expect(p).toContain("USER: hi");
  });
});

describe("terminal command construction", () => {
  it("shell-quotes paths with spaces and single quotes", () => {
    expect(shellQuote("/a b/c")).toBe("'/a b/c'");
    expect(shellQuote("/a'b")).toBe(`'/a'\\''b'`);
  });

  it("builds the resume command and applescript args", () => {
    expect(resumeCommand("/w/my app", SID.a1)).toBe(`cd '/w/my app' && claude --resume ${SID.a1}`);
    const args = openTerminalScript("/w/p", SID.a1);
    expect(args[0]).toBe("-e");
    expect(args[1]).toContain('tell application "Terminal" to do script');
    expect(args[1]).toContain(`claude --resume ${SID.a1}`);
    expect(args[3]).toContain("activate");
  });

  it("escapes double quotes for applescript", () => {
    const args = openTerminalScript(`/w/we"ird`, SID.a1);
    expect(args[1]).toContain('we\\"ird');
  });
});

describe("timeline", () => {
  it("returns newest-first entries across projects with inDeck flags", () => {
    writeHistory(world, [
      { display: "alpha one", timestamp: 1000, project: "/w/alpha", sessionId: SID.a1 },
      { display: "beta one", timestamp: 2000, project: "/w/beta", sessionId: SID.b1 },
      { display: "alpha two", timestamp: 3000, project: "/w/alpha", sessionId: SID.a1 },
    ]);
    addProject("/w/alpha");

    const entries = timeline();
    expect(entries.map((e) => e.display)).toEqual(["alpha two", "beta one", "alpha one"]);
    expect(entries[0]).toMatchObject({ projectName: "alpha", inDeck: true, sessionId: SID.a1 });
    expect(entries[1]).toMatchObject({ projectName: "beta", inDeck: false });
  });

  it("respects the limit by taking the newest entries", () => {
    writeHistory(
      world,
      Array.from({ length: 10 }, (_, i) => ({
        display: `p${i}`,
        timestamp: 1000 + i,
        project: "/w/alpha",
        sessionId: SID.a1,
      })),
    );
    const entries = timeline(3);
    expect(entries.map((e) => e.display)).toEqual(["p9", "p8", "p7"]);
  });

  it("returns [] with no history file", () => {
    expect(timeline()).toEqual([]);
  });
});
