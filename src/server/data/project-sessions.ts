import fs from "node:fs";
import path from "node:path";
import { claudeDir, encodeProjectPath } from "./paths.js";
import { readHistoryIndex } from "./history.js";
import { readLiveSessions } from "./sessions.js";
import { tailReadJsonl, extractAiTitle } from "./transcripts.js";

export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Small tail window — only fishing for ai-title, not the thread. */
const TITLE_WINDOW = 64 * 1024;

export interface ProjectSession {
  id: string;
  title: string;
  firstPrompt: string;
  lastPrompt: string;
  promptCount: number;
  lastTs: number;
  size: number;
  live: { pid: number; status: "busy" | "idle"; name: string } | null;
}

export function transcriptFile(projectPath: string, sessionId: string): string {
  return path.join(claudeDir(), "projects", encodeProjectPath(projectPath), `${sessionId}.jsonl`);
}

/**
 * All sessions of a project: transcript files joined with history aggregates
 * and live session state, newest activity first.
 * Title priority: live name → ai-title from transcript tail → first prompt → short id.
 */
export function listProjectSessions(projectPath: string): ProjectSession[] {
  const dir = path.join(claudeDir(), "projects", encodeProjectPath(projectPath));
  let files: fs.Dirent[];
  try {
    files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl") && SESSION_ID_RE.test(e.name.replace(/\.jsonl$/, "")));
  } catch {
    files = [];
  }

  const history = readHistoryIndex();
  const projectHistory = history.projects.get(projectPath);
  const live = readLiveSessions().filter((s) => s.cwd === projectPath);

  const sessions: ProjectSession[] = files.map((f) => {
    const id = f.name.replace(/\.jsonl$/, "");
    const file = path.join(dir, f.name);
    const hist = projectHistory?.sessions.get(id);
    const liveSess = live.find((s) => s.sessionId === id);

    let aiTitle: string | null = null;
    let size = 0;
    let mtimeMs = 0;
    try {
      const stat = fs.statSync(file);
      size = stat.size;
      mtimeMs = stat.mtimeMs;
      aiTitle = extractAiTitle(tailReadJsonl(file, TITLE_WINDOW).lines);
    } catch {
      // unreadable file — keep the id row anyway
    }

    return {
      id,
      title: liveSess?.name ?? aiTitle ?? snippet(hist?.firstPrompt) ?? id.slice(0, 8),
      firstPrompt: hist?.firstPrompt ?? "",
      lastPrompt: hist?.lastPrompt ?? "",
      promptCount: hist?.promptCount ?? 0,
      lastTs: hist?.lastTs ?? mtimeMs,
      size,
      live: liveSess ? { pid: liveSess.pid, status: liveSess.status, name: liveSess.name } : null,
    };
  });

  return sessions.sort((a, b) => Number(!!b.live) - Number(!!a.live) || b.lastTs - a.lastTs);
}

function snippet(prompt: string | undefined): string | null {
  if (!prompt?.trim()) return null;
  const s = prompt.trim().replace(/\s+/g, " ");
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}
