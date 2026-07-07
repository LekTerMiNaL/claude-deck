import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encodeProjectPath } from "./paths.js";
import { clearHistoryCache } from "./history.js";

/** A synthesized ~/.claude + ~/.claude-deck world for tests. Never real data. */
export interface FixtureWorld {
  claudeDir: string;
  configDir: string;
  /** Fake workspace where "real" project folders live. */
  workDir: string;
  cleanup: () => void;
}

export interface FixtureHistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export function makeWorld(): FixtureWorld {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "claude-deck-test-"));
  const claudeDir = path.join(base, "claude");
  const configDir = path.join(base, "deck-config");
  const workDir = path.join(base, "work");
  fs.mkdirSync(path.join(claudeDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, "sessions"), { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

  process.env.CLAUDE_DECK_CLAUDE_DIR = claudeDir;
  process.env.CLAUDE_DECK_CONFIG_DIR = configDir;
  process.env.CLAUDE_DECK_FAKE_PIDS = "";
  clearHistoryCache();

  return {
    claudeDir,
    configDir,
    workDir,
    cleanup: () => {
      fs.rmSync(base, { recursive: true, force: true });
      delete process.env.CLAUDE_DECK_CLAUDE_DIR;
      delete process.env.CLAUDE_DECK_CONFIG_DIR;
      delete process.env.CLAUDE_DECK_FAKE_PIDS;
      clearHistoryCache();
    },
  };
}

export function writeHistory(world: FixtureWorld, entries: FixtureHistoryEntry[]): void {
  const lines = entries.map((e) => JSON.stringify({ ...e, pastedContents: {} }));
  fs.writeFileSync(path.join(world.claudeDir, "history.jsonl"), lines.join("\n") + "\n");
  clearHistoryCache();
}

/** Create a fake "real" project folder inside the world's workspace. */
export function makeProjectFolder(world: FixtureWorld, name: string): string {
  const p = path.join(world.workDir, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** Create the encoded transcripts dir with n fake session transcript files. */
export function makeTranscripts(world: FixtureWorld, realPath: string, sessionIds: string[]): void {
  const dir = path.join(world.claudeDir, "projects", encodeProjectPath(realPath));
  fs.mkdirSync(dir, { recursive: true });
  for (const id of sessionIds) {
    fs.writeFileSync(
      path.join(dir, `${id}.jsonl`),
      JSON.stringify({ type: "user", message: { role: "user", content: "fixture prompt" } }) + "\n",
    );
  }
}

export function makeSessionFile(
  world: FixtureWorld,
  opts: { pid: number; sessionId: string; cwd: string; status?: string; name?: string; startedAt?: number },
): void {
  const file = path.join(world.claudeDir, "sessions", `${opts.pid}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({
      pid: opts.pid,
      sessionId: opts.sessionId,
      cwd: opts.cwd,
      name: opts.name,
      status: opts.status ?? "idle",
      startedAt: opts.startedAt ?? 1700000000000,
      updatedAt: (opts.startedAt ?? 1700000000000) + 60_000,
    }),
  );
}

export function setFakePids(pids: number[]): void {
  process.env.CLAUDE_DECK_FAKE_PIDS = pids.join(",");
}

export const SID = {
  a1: "aaaaaaa1-1111-4111-8111-111111111111",
  a2: "aaaaaaa2-2222-4222-8222-222222222222",
  b1: "bbbbbbb1-3333-4333-8333-333333333333",
  c1: "ccccccc1-4444-4444-8444-444444444444",
} as const;
