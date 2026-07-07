import fs from "node:fs";
import path from "node:path";
import { claudeDir } from "./paths.js";

export interface SessionHistory {
  sessionId: string;
  firstPrompt: string;
  lastPrompt: string;
  promptCount: number;
  firstTs: number;
  lastTs: number;
}

export interface ProjectHistory {
  /** Real absolute path as recorded by Claude Code. */
  path: string;
  promptCount: number;
  lastTs: number;
  lastPrompt: string;
  sessions: Map<string, SessionHistory>;
}

export interface HistoryIndex {
  /** Keyed by real project path. */
  projects: Map<string, ProjectHistory>;
  /** Keyed by sessionId — for enriching live sessions with their last prompt. */
  sessions: Map<string, SessionHistory & { project: string }>;
}

interface HistoryLine {
  display?: string;
  timestamp?: number;
  project?: string;
  sessionId?: string;
}

let cache: { mtimeMs: number; size: number; index: HistoryIndex } | null = null;

/** Parse ~/.claude/history.jsonl into per-project / per-session aggregates. */
export function readHistoryIndex(): HistoryIndex {
  const file = path.join(claudeDir(), "history.jsonl");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return { projects: new Map(), sessions: new Map() };
  }
  if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return cache.index;
  }

  const index: HistoryIndex = { projects: new Map(), sessions: new Map() };
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: HistoryLine;
    try {
      entry = JSON.parse(line) as HistoryLine;
    } catch {
      continue;
    }
    const { display, timestamp, project, sessionId } = entry;
    if (!display || !timestamp || !project || !sessionId) continue;

    let proj = index.projects.get(project);
    if (!proj) {
      proj = { path: project, promptCount: 0, lastTs: 0, lastPrompt: "", sessions: new Map() };
      index.projects.set(project, proj);
    }
    proj.promptCount++;
    if (timestamp >= proj.lastTs) {
      proj.lastTs = timestamp;
      proj.lastPrompt = display;
    }

    let sess = proj.sessions.get(sessionId);
    if (!sess) {
      sess = {
        sessionId,
        firstPrompt: display,
        lastPrompt: display,
        promptCount: 0,
        firstTs: timestamp,
        lastTs: timestamp,
      };
      proj.sessions.set(sessionId, sess);
      index.sessions.set(sessionId, { ...sess, project });
    }
    sess.promptCount++;
    if (timestamp <= sess.firstTs) {
      sess.firstTs = timestamp;
      sess.firstPrompt = display;
    }
    if (timestamp >= sess.lastTs) {
      sess.lastTs = timestamp;
      sess.lastPrompt = display;
    }
    const flat = index.sessions.get(sessionId)!;
    Object.assign(flat, sess, { project });
  }

  cache = { mtimeMs: stat.mtimeMs, size: stat.size, index };
  return index;
}

/** Test hook — drop the mtime cache. */
export function clearHistoryCache(): void {
  cache = null;
}
