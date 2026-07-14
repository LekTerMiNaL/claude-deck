import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractMessages, refreshSessionIndex, refreshTextIndex, deepSearch } from "./text-index.js";
import { encodeProjectPath } from "./paths.js";
import {
  makeWorld,
  writeHistory,
  makeProjectFolder,
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

const J = (o: object) => JSON.stringify(o);
const uLine = (text: string, ts = "2026-07-01T10:00:00Z") =>
  J({ type: "user", timestamp: ts, message: { role: "user", content: text } });
const aLine = (text: string, ts = "2026-07-01T10:01:00Z") =>
  J({ type: "assistant", timestamp: ts, message: { role: "assistant", content: [{ type: "text", text }] } });

describe("extractMessages", () => {
  it("keeps user/assistant text, skips carriers, sidechain, meta and noise", () => {
    const msgs = extractMessages(
      [
        uLine("fix the bug"),
        aLine("found it in the cache layer"),
        J({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "x" }] } }),
        J({ type: "user", isSidechain: true, message: { role: "user", content: "subagent" } }),
        J({ type: "user", isMeta: true, message: { role: "user", content: "meta" } }),
        J({ type: "ai-title", aiTitle: "T" }),
        "not json at all",
      ].join("\n"),
    );
    expect(msgs.map((m) => [m.role, m.text])).toEqual([
      ["user", "fix the bug"],
      ["assistant", "found it in the cache layer"],
    ]);
  });
});

describe("refreshSessionIndex (incremental)", () => {
  const src = () => path.join(world.workDir, "t.jsonl");
  const out = () => path.join(world.configDir, "text-index", "p", SID.a1);

  it("parses only the appended delta on the second pass", () => {
    fs.writeFileSync(src(), uLine("first") + "\n");
    expect(refreshSessionIndex(src(), out())).toBe(1);
    expect(refreshSessionIndex(src(), out())).toBe(0); // unchanged → no work

    fs.appendFileSync(src(), aLine("second") + "\n");
    expect(refreshSessionIndex(src(), out())).toBe(1); // only the new line

    const cached = fs.readFileSync(`${out()}.jsonl`, "utf8").trim().split("\n");
    expect(cached).toHaveLength(2); // no duplicates
  });

  it("leaves a trailing partial line for the next refresh", () => {
    fs.writeFileSync(src(), uLine("done") + "\n" + uLine("partial").slice(0, 20)); // no trailing \n
    expect(refreshSessionIndex(src(), out())).toBe(1);
    // the partial line completes later
    fs.appendFileSync(src(), uLine("partial").slice(20) + "\n");
    expect(refreshSessionIndex(src(), out())).toBe(1);
    const cached = fs.readFileSync(`${out()}.jsonl`, "utf8").trim().split("\n");
    expect(cached).toHaveLength(2);
  });

  it("rebuilds from scratch when the source shrank", () => {
    fs.writeFileSync(src(), uLine("aaa") + "\n" + uLine("bbb") + "\n");
    expect(refreshSessionIndex(src(), out())).toBe(2);
    fs.writeFileSync(src(), uLine("rewritten") + "\n"); // smaller file
    expect(refreshSessionIndex(src(), out())).toBe(1);
    const cached = fs.readFileSync(`${out()}.jsonl`, "utf8").trim().split("\n");
    expect(cached).toHaveLength(1);
    expect(cached[0]).toContain("rewritten");
  });
});

describe("refreshTextIndex + deepSearch", () => {
  function seedTranscript(realPath: string, sessionId: string, lines: string[]) {
    const dir = path.join(world.claudeDir, "projects", encodeProjectPath(realPath));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), lines.join("\n") + "\n");
  }

  it("finds Thai + case-insensitive matches across projects with snippets", () => {
    const alpha = makeProjectFolder(world, "alpha");
    const beta = makeProjectFolder(world, "beta");
    writeHistory(world, [
      { display: "x", timestamp: 1, project: alpha, sessionId: SID.a1 },
      { display: "y", timestamp: 2, project: beta, sessionId: SID.b1 },
    ]);
    seedTranscript(alpha, SID.a1, [
      uLine("ช่วยแก้ราคาทองไม่อัปเดตหน่อย", "2026-07-01T09:00:00Z"),
      aLine("The GOLD price cache key was stale — fixed.", "2026-07-01T09:01:00Z"),
    ]);
    seedTranscript(beta, SID.b1, [aLine("nothing relevant here")]);

    const stats = refreshTextIndex();
    expect(stats.files).toBe(2);
    expect(stats.newMessages).toBe(3);

    const thai = deepSearch("ราคาทอง");
    expect(thai.total).toBe(1);
    expect(thai.matches[0]).toMatchObject({ projectName: "alpha", sessionId: SID.a1, role: "user" });
    expect(thai.matches[0]?.snippet).toContain("ราคาทอง");

    const eng = deepSearch("gold price");
    expect(eng.total).toBe(1);
    expect(eng.matches[0]?.role).toBe("assistant");

    // second refresh with nothing changed indexes nothing
    expect(refreshTextIndex().newMessages).toBe(0);
  });

  it("windows long text into a snippet around the hit", () => {
    const alpha = makeProjectFolder(world, "alpha");
    writeHistory(world, [{ display: "x", timestamp: 1, project: alpha, sessionId: SID.a1 }]);
    seedTranscript(alpha, SID.a1, [aLine("x".repeat(500) + " NEEDLE " + "y".repeat(500))]);
    refreshTextIndex();
    const { matches } = deepSearch("needle");
    const snippet = matches[0]?.snippet ?? "";
    expect(snippet).toContain("NEEDLE");
    expect(snippet.length).toBeLessThan(260);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("respects limit while total counts everything; empty index returns nothing", () => {
    expect(deepSearch("anything")).toEqual({ matches: [], total: 0 });
    const alpha = makeProjectFolder(world, "alpha");
    writeHistory(world, [{ display: "x", timestamp: 1, project: alpha, sessionId: SID.a1 }]);
    seedTranscript(
      alpha,
      SID.a1,
      Array.from({ length: 5 }, (_, i) => uLine(`repeat hit ${i}`, `2026-07-0${i + 1}T00:00:00Z`)),
    );
    refreshTextIndex();
    const { matches, total } = deepSearch("repeat hit", 2);
    expect(total).toBe(5);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.ts).toBe("2026-07-05T00:00:00Z"); // newest first
  });
});
