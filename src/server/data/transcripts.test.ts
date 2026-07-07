import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tailReadJsonl, parseThread, extractAiTitle } from "./transcripts.js";
import { listProjectSessions } from "./project-sessions.js";
import {
  makeWorld,
  writeHistory,
  makeSessionFile,
  setFakePids,
  SID,
  type FixtureWorld,
} from "./test-helpers.js";
import { encodeProjectPath } from "./paths.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

const J = (o: object) => JSON.stringify(o);
const userLine = (text: string, ts = "2026-01-01T10:00:00Z") =>
  J({ type: "user", timestamp: ts, message: { role: "user", content: text } });
const asstLine = (blocks: object[], ts = "2026-01-01T10:01:00Z") =>
  J({ type: "assistant", timestamp: ts, message: { role: "assistant", content: blocks } });

function writeTranscript(realPath: string, sessionId: string, lines: string[]): string {
  const dir = path.join(world.claudeDir, "projects", encodeProjectPath(realPath));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.jsonl`);
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

describe("tailReadJsonl", () => {
  it("reads whole small files (complete=true)", () => {
    const file = writeTranscript("/w/p", SID.a1, [userLine("hi"), asstLine([{ type: "text", text: "yo" }])]);
    const tail = tailReadJsonl(file);
    expect(tail.lines).toHaveLength(2);
    expect(tail.complete).toBe(true);
  });

  it("caps the window and drops the partial first line", () => {
    const lines = Array.from({ length: 200 }, (_, i) => userLine(`prompt number ${i} ${"x".repeat(100)}`));
    const file = writeTranscript("/w/p", SID.a1, lines);
    const tail = tailReadJsonl(file, 4 * 1024);
    expect(tail.complete).toBe(false);
    expect(tail.lines.length).toBeGreaterThan(5);
    expect(tail.lines.length).toBeLessThan(40);
    // every surviving line parsed cleanly (no partial garbage)
    for (const l of tail.lines) expect((l as { type: string }).type).toBe("user");
  });
});

describe("parseThread", () => {
  it("renders string user content and assistant text+tool chips", () => {
    const thread = parseThread([
      JSON.parse(userLine("fix the bug")),
      JSON.parse(
        asstLine([
          { type: "text", text: "found it" },
          { type: "tool_use", name: "Read" },
          { type: "tool_use", name: "Edit" },
        ]),
      ),
    ]);
    expect(thread).toHaveLength(2);
    expect(thread[0]).toMatchObject({ role: "user", text: "fix the bug", tools: [] });
    expect(thread[1]).toMatchObject({ role: "assistant", text: "found it", tools: ["Read", "Edit"] });
  });

  it("skips tool_result carriers, sidechain, meta and non-message lines", () => {
    const thread = parseThread([
      { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "…" }] } },
      { type: "user", isSidechain: true, message: { role: "user", content: "subagent noise" } },
      { type: "user", isMeta: true, message: { role: "user", content: "meta noise" } },
      { type: "file-history-snapshot", messageId: "x" },
      { type: "ai-title", aiTitle: "T" },
      { type: "progress" },
      JSON.parse(userLine("real prompt")),
    ]);
    expect(thread).toHaveLength(1);
    expect(thread[0]?.text).toBe("real prompt");
  });

  it("keeps only the last `limit` messages", () => {
    const lines = Array.from({ length: 30 }, (_, i) => JSON.parse(userLine(`p${i}`)));
    const thread = parseThread(lines, 10);
    expect(thread).toHaveLength(10);
    expect(thread[0]?.text).toBe("p20");
    expect(thread[9]?.text).toBe("p29");
  });
});

describe("extractAiTitle", () => {
  it("returns the last ai-title", () => {
    expect(
      extractAiTitle([{ type: "ai-title", aiTitle: "old" }, { type: "user" }, { type: "ai-title", aiTitle: "new" }]),
    ).toBe("new");
    expect(extractAiTitle([{ type: "user" }])).toBeNull();
  });
});

describe("listProjectSessions", () => {
  it("joins transcripts x history x live, with title priority", () => {
    const proj = "/w/alpha";
    writeTranscript(proj, SID.a1, [userLine("live session prompt")]);
    writeTranscript(proj, SID.a2, [userLine("x"), J({ type: "ai-title", aiTitle: "Nice AI Title" })]);
    writeTranscript(proj, SID.b1, [userLine("plain old session")]);
    writeHistory(world, [
      { display: "live session prompt", timestamp: 3000, project: proj, sessionId: SID.a1 },
      { display: "ai titled session", timestamp: 2000, project: proj, sessionId: SID.a2 },
      { display: "plain old session", timestamp: 1000, project: proj, sessionId: SID.b1 },
    ]);
    makeSessionFile(world, { pid: 500, sessionId: SID.a1, cwd: proj, status: "busy", name: "alpha-9" });
    setFakePids([500]);

    const sessions = listProjectSessions(proj);
    expect(sessions.map((s) => s.id)).toEqual([SID.a1, SID.a2, SID.b1]); // live first, then lastTs desc
    expect(sessions[0]?.title).toBe("alpha-9"); // live name wins
    expect(sessions[0]?.live?.status).toBe("busy");
    expect(sessions[1]?.title).toBe("Nice AI Title"); // ai-title beats first prompt
    expect(sessions[2]?.title).toBe("plain old session"); // first prompt fallback
    expect(sessions[2]?.live).toBeNull();
  });

  it("returns [] for a project with no transcripts", () => {
    expect(listProjectSessions("/nowhere")).toEqual([]);
  });
});
