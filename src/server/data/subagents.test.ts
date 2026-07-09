import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseThread, firstUserText } from "./transcripts.js";
import { listSessionAgents, readSubagentThread, AGENT_ID_RE } from "./subagents.js";
import { encodeProjectPath } from "./paths.js";
import { makeWorld, SID, type FixtureWorld } from "./test-helpers.js";

let world: FixtureWorld;
beforeEach(() => {
  world = makeWorld();
});
afterEach(() => {
  world.cleanup();
});

const side = (o: object) => JSON.stringify({ isSidechain: true, ...o });
const sUser = (text: string) => side({ type: "user", timestamp: "2026-01-01T00:00:00Z", message: { role: "user", content: text } });
const sAsst = (blocks: object[]) =>
  side({ type: "assistant", timestamp: "2026-01-01T00:01:00Z", message: { role: "assistant", content: blocks } });

function writeAgent(sessionId: string, rel: string, agentId: string, meta: object, lines: string[]) {
  const base = path.join(world.claudeDir, "projects", encodeProjectPath("/w/p"), sessionId, "subagents", rel);
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, `${agentId}.jsonl`), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(base, `${agentId}.meta.json`), JSON.stringify(meta));
}

describe("parseThread includeSidechain + firstUserText", () => {
  it("skips sidechain by default but keeps it when asked", () => {
    const lines = [JSON.parse(sUser("task for the subagent"))];
    expect(parseThread(lines)).toHaveLength(0);
    expect(parseThread(lines, 80, { includeSidechain: true })).toHaveLength(1);
  });

  it("firstUserText returns the first user prompt (sidechain ok)", () => {
    const lines = [JSON.parse(sAsst([{ type: "text", text: "hmm" }])), JSON.parse(sUser("the real task"))];
    // note: first user line is second here
    expect(firstUserText(lines)).toBe("the real task");
    expect(firstUserText([JSON.parse(sUser("  spaced  "))])).toBe("spaced");
  });
});

describe("listSessionAgents", () => {
  it("lists Task agents with meta + counts and workflow runs", () => {
    writeAgent(SID.a1, ".", "agent-aaa1", { agentType: "builder", description: "Build login" }, [
      sUser("Build the login feature"),
      sAsst([{ type: "text", text: "done, wired jose auth" }, { type: "tool_use", name: "Edit" }]),
    ]);
    writeAgent(SID.a1, ".", "agent-aaa2", { agentType: "reviewer", description: "Review login" }, [
      sUser("Review the login feature"),
      sAsst([{ type: "text", text: "looks good" }]),
    ]);
    writeAgent(SID.a1, "workflows/wf_abc123", "agent-b1", { agentType: "workflow-subagent" }, [
      sUser("find bugs"),
      sAsst([{ type: "tool_use", name: "Grep" }]),
    ]);
    writeAgent(SID.a1, "workflows/wf_abc123", "agent-b2", { agentType: "workflow-subagent" }, [sUser("verify bug")]);

    const { taskAgents, workflows } = listSessionAgents("/w/p", SID.a1);
    expect(taskAgents.map((a) => a.agentType).sort()).toEqual(["builder", "reviewer"]);
    const builder = taskAgents.find((a) => a.agentType === "builder")!;
    expect(builder).toMatchObject({ description: "Build login", messageCount: 2, toolCount: 1 });
    expect(builder.firstPrompt).toBe("Build the login feature");
    expect(builder.finalText).toBe("done, wired jose auth");

    expect(workflows).toHaveLength(1);
    expect(workflows[0]?.wfId).toBe("wf_abc123");
    expect(workflows[0]?.agents.map((a) => a.agentId)).toEqual(["agent-b1", "agent-b2"]);
  });

  it("returns empty when a session has no subagents dir", () => {
    expect(listSessionAgents("/w/p", SID.b1)).toEqual({ taskAgents: [], workflows: [] });
  });
});

describe("readSubagentThread", () => {
  it("reads a top-level agent transcript including sidechain", () => {
    writeAgent(SID.a1, ".", "agent-aaa1", { agentType: "builder" }, [
      sUser("do the thing"),
      sAsst([{ type: "text", text: "did it" }]),
    ]);
    const thread = readSubagentThread("/w/p", SID.a1, "agent-aaa1");
    expect(thread).toHaveLength(2);
    expect(thread?.[0]?.text).toBe("do the thing");
  });

  it("finds an agent nested in a workflow run", () => {
    writeAgent(SID.a1, "workflows/wf_z", "agent-cc9", { agentType: "workflow-subagent" }, [sUser("nested task")]);
    const thread = readSubagentThread("/w/p", SID.a1, "agent-cc9");
    expect(thread?.[0]?.text).toBe("nested task");
  });

  it("guards ids and returns null for missing / bad ids", () => {
    expect(AGENT_ID_RE.test("agent-abc123")).toBe(true);
    expect(AGENT_ID_RE.test("../etc/passwd")).toBe(false);
    expect(AGENT_ID_RE.test("agent-../x")).toBe(false);
    expect(readSubagentThread("/w/p", SID.a1, "agent-nope")).toBeNull();
    expect(readSubagentThread("/w/p", SID.a1, "../evil")).toBeNull();
  });
});
