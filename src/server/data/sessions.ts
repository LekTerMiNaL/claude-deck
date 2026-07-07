import fs from "node:fs";
import path from "node:path";
import { claudeDir } from "./paths.js";

export interface LiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  name: string;
  status: "busy" | "idle";
  startedAt: number;
  updatedAt: number;
}

interface SessionFile {
  pid?: number;
  sessionId?: string;
  cwd?: string;
  name?: string;
  status?: string;
  startedAt?: number;
  updatedAt?: number;
}

function fakePids(): Set<number> {
  const raw = process.env.CLAUDE_DECK_FAKE_PIDS;
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => Number(s.trim())).filter(Number.isInteger));
}

/** Session files linger after exit — a session is live only if its pid is. */
function isPidAlive(pid: number): boolean {
  if (fakePids().has(pid)) return true;
  // When fake pids are set we are in a test/fixture world: never report the
  // machine's real processes as live, so runs are deterministic.
  if (process.env.CLAUDE_DECK_FAKE_PIDS) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Read ~/.claude/sessions/*.json and keep only sessions whose process is alive. */
export function readLiveSessions(): LiveSession[] {
  const dir = path.join(claudeDir(), "sessions");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const live: LiveSession[] = [];
  for (const file of files) {
    let parsed: SessionFile;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as SessionFile;
    } catch {
      continue;
    }
    const { pid, sessionId, cwd, startedAt } = parsed;
    if (!pid || !sessionId || !cwd || !startedAt) continue;
    if (!isPidAlive(pid)) continue;
    live.push({
      pid,
      sessionId,
      cwd,
      name: parsed.name ?? sessionId.slice(0, 8),
      status: parsed.status === "busy" ? "busy" : "idle",
      startedAt,
      updatedAt: parsed.updatedAt ?? startedAt,
    });
  }
  return live.sort((a, b) => b.updatedAt - a.updatedAt);
}
