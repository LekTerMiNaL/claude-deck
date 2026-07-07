import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { encodeProjectPath, expandHome, shortenHome } from "./paths.js";
import { readHistoryIndex, clearHistoryCache } from "./history.js";
import { readLiveSessions } from "./sessions.js";
import { scanProjects, rootChildren } from "./scan.js";
import { readConfig, writeConfig, addProject, removeProject, addRoot } from "./config.js";
import { deckCards, liveCards } from "./deck.js";
import {
  makeWorld,
  writeHistory,
  makeProjectFolder,
  makeTranscripts,
  makeSessionFile,
  setFakePids,
  SID,
  type FixtureWorld,
} from "./test-helpers.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

describe("paths", () => {
  it("encodes every non-alphanumeric char to '-' (lossy)", () => {
    expect(encodeProjectPath("/Users/lek/Ai/gyo-demo")).toBe("-Users-lek-Ai-gyo-demo");
    // the documented collision
    expect(encodeProjectPath("/a/gyo-demo")).toBe(encodeProjectPath("/a/gyo/demo"));
  });

  it("expands ~ and shortens home", () => {
    const home = process.env.HOME!;
    expect(expandHome("~/x")).toBe(path.join(home, "x"));
    expect(shortenHome(path.join(home, "x"))).toBe("~/x");
    expect(shortenHome("/opt/x")).toBe("/opt/x");
  });
});

describe("history", () => {
  it("aggregates per project and per session", () => {
    const proj = "/work/alpha";
    writeHistory(world, [
      { display: "first prompt", timestamp: 1000, project: proj, sessionId: SID.a1 },
      { display: "second prompt", timestamp: 2000, project: proj, sessionId: SID.a1 },
      { display: "other session", timestamp: 3000, project: proj, sessionId: SID.a2 },
    ]);
    const idx = readHistoryIndex();
    const p = idx.projects.get(proj)!;
    expect(p.promptCount).toBe(3);
    expect(p.lastTs).toBe(3000);
    expect(p.lastPrompt).toBe("other session");
    const s1 = p.sessions.get(SID.a1)!;
    expect(s1.firstPrompt).toBe("first prompt");
    expect(s1.lastPrompt).toBe("second prompt");
    expect(s1.promptCount).toBe(2);
    expect(idx.sessions.get(SID.a2)?.project).toBe(proj);
  });

  it("skips malformed lines and missing file", () => {
    expect(readHistoryIndex().projects.size).toBe(0);
    fs.writeFileSync(path.join(world.claudeDir, "history.jsonl"), "not json\n{}\n");
    clearHistoryCache();
    expect(readHistoryIndex().projects.size).toBe(0);
  });
});

describe("sessions", () => {
  it("keeps only sessions whose pid is alive (fake pids in tests)", () => {
    makeSessionFile(world, { pid: 111, sessionId: SID.a1, cwd: "/work/alpha", status: "busy" });
    makeSessionFile(world, { pid: 222, sessionId: SID.a2, cwd: "/work/beta" });
    setFakePids([111]);
    const live = readLiveSessions();
    expect(live).toHaveLength(1);
    expect(live[0]?.pid).toBe(111);
    expect(live[0]?.status).toBe("busy");
  });

  it("returns [] when the sessions dir does not exist", () => {
    fs.rmSync(path.join(world.claudeDir, "sessions"), { recursive: true });
    expect(readLiveSessions()).toEqual([]);
  });
});

describe("config", () => {
  it("round-trips and is resilient to a missing file", () => {
    expect(readConfig()).toEqual({ projects: [], roots: [] });
    writeConfig({ projects: ["/a"], roots: ["/r"] });
    expect(readConfig()).toEqual({ projects: ["/a"], roots: ["/r"] });
  });

  it("add/remove project and addRoot are idempotent", () => {
    addProject("/a");
    addProject("/a");
    addRoot("/r");
    addRoot("/r");
    expect(readConfig()).toEqual({ projects: ["/a"], roots: ["/r"] });
    removeProject("/a");
    expect(readConfig().projects).toEqual([]);
  });
});

describe("scan", () => {
  it("recovers real paths from history and marks orphans missing", () => {
    const alpha = makeProjectFolder(world, "alpha");
    const ghostReal = path.join(world.workDir, "ghost"); // never created on disk
    writeHistory(world, [
      { display: "hi alpha", timestamp: 2000, project: alpha, sessionId: SID.a1 },
      { display: "hi ghost", timestamp: 1000, project: ghostReal, sessionId: SID.b1 },
    ]);
    makeTranscripts(world, alpha, [SID.a1]);
    makeTranscripts(world, ghostReal, [SID.b1]);

    const items = scanProjects();
    expect(items.map((i) => i.name)).toEqual(["alpha", "ghost"]); // sorted by lastTs desc
    expect(items[0]).toMatchObject({ path: alpha, missing: false, sessionCount: 1, lastPrompt: "hi alpha" });
    expect(items[1]).toMatchObject({ path: ghostReal, missing: true });
  });

  it("resolves paths for root subfolders that have no history", () => {
    const beta = makeProjectFolder(world, "beta");
    makeTranscripts(world, beta, [SID.a1]); // transcripts but no history line
    addRoot(world.workDir);
    const items = scanProjects();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ path: beta, name: "beta", missing: false });
  });

  it("keeps unresolvable encoded dirs as orphans with the encoded name", () => {
    const unknownReal = "/somewhere/else/mystery";
    makeTranscripts(world, unknownReal, [SID.c1]);
    const items = scanProjects();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ path: null, missing: true, name: encodeProjectPath(unknownReal) });
  });

  it("lists root children with hasHistory flags", () => {
    const a = makeProjectFolder(world, "aaa");
    makeProjectFolder(world, "bbb");
    writeHistory(world, [{ display: "x", timestamp: 1, project: a, sessionId: SID.a1 }]);
    const children = rootChildren(world.workDir);
    expect(children).toEqual([
      { name: "aaa", path: a, hasHistory: true },
      { name: "bbb", path: path.join(world.workDir, "bbb"), hasHistory: false },
    ]);
  });
});

describe("deck", () => {
  it("joins config x history x live sessions", () => {
    const alpha = makeProjectFolder(world, "alpha");
    writeHistory(world, [
      { display: "p1", timestamp: 1000, project: alpha, sessionId: SID.a1 },
      { display: "p2", timestamp: 2000, project: alpha, sessionId: SID.a1 },
    ]);
    makeTranscripts(world, alpha, [SID.a1, SID.a2]);
    makeSessionFile(world, { pid: 111, sessionId: SID.a1, cwd: alpha, status: "busy", name: "alpha-1" });
    setFakePids([111]);
    addProject(alpha);

    const deck = deckCards();
    expect(deck).toHaveLength(1);
    expect(deck[0]).toMatchObject({
      name: "alpha",
      sessionCount: 2,
      promptCount: 2,
      lastPrompt: "p2",
      liveCount: 1,
      missing: false,
    });

    const live = liveCards();
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      name: "alpha-1",
      status: "busy",
      projectName: "alpha",
      lastPrompt: "p2",
      inDeck: true,
    });
  });
});
