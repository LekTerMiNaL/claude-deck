import fs from "node:fs";
import path from "node:path";
import { encodeProjectPath, shortenHome, claudeDir } from "./paths.js";
import { readHistoryIndex } from "./history.js";
import { readLiveSessions, type LiveSession } from "./sessions.js";
import { readConfig } from "./config.js";

export interface LiveCard {
  pid: number;
  sessionId: string;
  name: string;
  status: "busy" | "idle";
  cwd: string;
  projectName: string;
  startedAt: number;
  lastPrompt: string;
  inDeck: boolean;
}

export interface DeckCard {
  path: string;
  displayPath: string;
  name: string;
  sessionCount: number;
  lastTs: number;
  promptCount: number;
  lastPrompt: string;
  liveCount: number;
  missing: boolean;
}

/** All live sessions, even ones whose project is not in the deck. */
export function liveCards(): LiveCard[] {
  const history = readHistoryIndex();
  const config = readConfig();
  return readLiveSessions().map((s: LiveSession) => ({
    pid: s.pid,
    sessionId: s.sessionId,
    name: s.name,
    status: s.status,
    cwd: s.cwd,
    projectName: path.basename(s.cwd),
    startedAt: s.startedAt,
    lastPrompt: history.sessions.get(s.sessionId)?.lastPrompt ?? "",
    inDeck: config.projects.includes(s.cwd),
  }));
}

function countSessionFilesFor(projectPath: string): number {
  const dir = path.join(claudeDir(), "projects", encodeProjectPath(projectPath));
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && UUID_RE.test(e.name)).length;
  } catch {
    return 0;
  }
}

/** One card per project the user added to the deck. */
export function deckCards(): DeckCard[] {
  const config = readConfig();
  const history = readHistoryIndex();
  const live = readLiveSessions();
  return config.projects.map((projectPath) => {
    const hist = history.projects.get(projectPath);
    return {
      path: projectPath,
      displayPath: shortenHome(projectPath),
      name: path.basename(projectPath),
      sessionCount: countSessionFilesFor(projectPath),
      lastTs: hist?.lastTs ?? 0,
      promptCount: hist?.promptCount ?? 0,
      lastPrompt: hist?.lastPrompt ?? "",
      liveCount: live.filter((s) => s.cwd === projectPath).length,
      missing: !fs.existsSync(projectPath),
    };
  });
}
