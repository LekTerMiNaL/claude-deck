import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { configDir } from "./paths.js";
import type { ThreadMessage } from "./transcripts.js";

export interface CachedSummary {
  sessionId: string;
  summary: string;
  /** Transcript size when summarized — a different size invalidates the cache. */
  transcriptSize: number;
  createdAt: number;
}

const MAX_MSG_CHARS = 400;
const MAX_MESSAGES = 40;
const TIMEOUT_MS = 90_000;

function summariesFile(): string {
  return path.join(configDir(), "summaries.json");
}

function readAll(): Record<string, CachedSummary> {
  try {
    return JSON.parse(fs.readFileSync(summariesFile(), "utf8")) as Record<string, CachedSummary>;
  } catch {
    return {};
  }
}

export function getCachedSummary(sessionId: string, transcriptSize: number): CachedSummary | null {
  const hit = readAll()[sessionId];
  return hit && hit.transcriptSize === transcriptSize ? hit : null;
}

export function cacheSummary(entry: CachedSummary): void {
  const all = readAll();
  all[entry.sessionId] = entry;
  fs.mkdirSync(configDir(), { recursive: true });
  const tmp = path.join(configDir(), `.summaries.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2) + "\n");
  fs.renameSync(tmp, summariesFile());
}

/** Compact transcript excerpt fed to `claude -p` — never the raw jsonl. */
export function buildSummaryInput(thread: ThreadMessage[]): string {
  return thread
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const text = m.text.length > MAX_MSG_CHARS ? m.text.slice(0, MAX_MSG_CHARS) + "…" : m.text;
      const tools = m.tools.length ? ` [tools: ${m.tools.join(", ")}]` : "";
      return `${m.role === "user" ? "USER" : "ASSISTANT"}: ${text}${tools}`;
    })
    .join("\n");
}

export function summaryPrompt(projectName: string, excerpt: string): string {
  return (
    `Below is an excerpt of a Claude Code session in the project "${projectName}". ` +
    `Summarize in Thai, 2-4 sentences: what was worked on, what got done, and any unfinished work. ` +
    `Reply with the summary text only.\n\n---\n${excerpt}`
  );
}

export function claudeBin(): string {
  return process.env.CLAUDE_DECK_CLAUDE_BIN ?? "claude";
}

/**
 * Run `claude -p` for a summary. Runs from the OS tmpdir so the target
 * project's CLAUDE.md/hooks are not loaded into the summarizer session.
 */
export function runClaudeSummary(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      claudeBin(),
      ["-p", prompt, "--model", "haiku"],
      { timeout: TIMEOUT_MS, cwd: os.tmpdir(), maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        // strip ANSI escapes, keep plain text
        // eslint-disable-next-line no-control-regex
        resolve(stdout.replace(/\x1b\[[0-9;]*m/g, "").trim());
      },
    );
  });
}
