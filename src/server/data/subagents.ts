import fs from "node:fs";
import path from "node:path";
import { claudeDir, encodeProjectPath } from "./paths.js";
import { tailReadJsonl, parseThread, firstUserText, type ThreadMessage } from "./transcripts.js";

export const AGENT_ID_RE = /^agent-[0-9a-f]+$/;
const WF_ID_RE = /^wf_[0-9a-z-]+$/i;

export interface AgentNode {
  agentId: string;
  agentType: string;
  description: string;
  firstPrompt: string;
  messageCount: number;
  toolCount: number;
  size: number;
  finalText: string;
  /** File birth/modify times — spawn order + "still writing" detection. */
  startedTs: number;
  lastTs: number;
  /** Transcript written to in the last 2 minutes → probably still running. */
  active: boolean;
}

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export interface WorkflowRun {
  wfId: string;
  agents: AgentNode[];
}

export interface SessionAgents {
  taskAgents: AgentNode[];
  workflows: WorkflowRun[];
}

interface AgentMeta {
  agentType?: string;
  description?: string;
}

function subagentsDir(projectPath: string, sessionId: string): string {
  return path.join(claudeDir(), "projects", encodeProjectPath(projectPath), sessionId, "subagents");
}

function readMeta(metaFile: string): AgentMeta {
  try {
    return JSON.parse(fs.readFileSync(metaFile, "utf8")) as AgentMeta;
  } catch {
    return {};
  }
}

/** Build an AgentNode from a subagent transcript file + its sibling .meta.json. */
function buildNode(dir: string, agentId: string, now = Date.now()): AgentNode {
  const file = path.join(dir, `${agentId}.jsonl`);
  const meta = readMeta(path.join(dir, `${agentId}.meta.json`));

  let messageCount = 0;
  let toolCount = 0;
  let size = 0;
  let firstPrompt = "";
  let finalText = "";
  let startedTs = 0;
  let lastTs = 0;
  try {
    const stat = fs.statSync(file);
    startedTs = stat.birthtimeMs || stat.mtimeMs;
    lastTs = stat.mtimeMs;
    const tail = tailReadJsonl(file);
    size = tail.size;
    const thread = parseThread(tail.lines, Number.MAX_SAFE_INTEGER, { includeSidechain: true });
    messageCount = thread.length;
    toolCount = thread.reduce((n, m) => n + m.tools.length, 0);
    firstPrompt = firstUserText(tail.lines);
    const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant" && m.text);
    finalText = lastAssistant?.text ?? "";
  } catch {
    // unreadable transcript — keep the meta-only row
  }

  return {
    agentId,
    agentType: meta.agentType ?? "agent",
    description: meta.description ?? "",
    firstPrompt,
    messageCount,
    toolCount,
    size,
    finalText,
    startedTs,
    lastTs,
    active: lastTs > 0 && now - lastTs < ACTIVE_WINDOW_MS,
  };
}

function agentIdsIn(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => e.name.replace(/\.jsonl$/, ""))
      .filter((id) => AGENT_ID_RE.test(id));
  } catch {
    return [];
  }
}

/** All subagents a session spawned: Task agents + workflow runs. */
export function listSessionAgents(projectPath: string, sessionId: string): SessionAgents {
  const dir = subagentsDir(projectPath, sessionId);

  const taskAgents = agentIdsIn(dir)
    .map((id) => ({ id, mtime: safeMtime(path.join(dir, `${id}.jsonl`)) }))
    .sort((a, b) => a.mtime - b.mtime)
    .map(({ id }) => buildNode(dir, id));

  const wfDir = path.join(dir, "workflows");
  let workflows: WorkflowRun[] = [];
  try {
    workflows = fs
      .readdirSync(wfDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && WF_ID_RE.test(e.name))
      .map((e) => {
        const runDir = path.join(wfDir, e.name);
        return {
          wfId: e.name,
          agents: agentIdsIn(runDir)
            .sort()
            .map((id) => buildNode(runDir, id)),
        };
      })
      .filter((w) => w.agents.length > 0)
      .sort((a, b) => a.wfId.localeCompare(b.wfId));
  } catch {
    workflows = [];
  }

  return { taskAgents, workflows };
}

function safeMtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/** Render a single subagent's transcript (sidechain-aware). null when missing. */
export function readSubagentThread(
  projectPath: string,
  sessionId: string,
  agentId: string,
): ThreadMessage[] | null {
  if (!AGENT_ID_RE.test(agentId)) return null;
  const dir = subagentsDir(projectPath, sessionId);
  // an agent lives either top-level or inside some workflows/wf_*/ run
  const candidates = [path.join(dir, `${agentId}.jsonl`)];
  try {
    const wfDir = path.join(dir, "workflows");
    for (const e of fs.readdirSync(wfDir, { withFileTypes: true })) {
      if (e.isDirectory()) candidates.push(path.join(wfDir, e.name, `${agentId}.jsonl`));
    }
  } catch {
    // no workflows dir
  }
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) return null;
  const tail = tailReadJsonl(file);
  return parseThread(tail.lines, 200, { includeSidechain: true });
}
