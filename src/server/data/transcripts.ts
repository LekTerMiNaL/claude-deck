import fs from "node:fs";

/** Renderable transcript message for the UI thread. */
export interface ThreadMessage {
  role: "user" | "assistant";
  text: string;
  tools: string[];
  ts: string | null;
}

export interface TranscriptTail {
  /** Parsed JSON lines from the tail window (first partial line dropped). */
  lines: unknown[];
  /** Total file size in bytes. */
  size: number;
  /** True when the window covers the whole file (nothing was cut off). */
  complete: boolean;
}

const DEFAULT_WINDOW = 512 * 1024;

/**
 * Read only the last `maxBytes` of a .jsonl file. Real transcripts reach
 * >100 MB — never load a whole file for the UI.
 */
export function tailReadJsonl(file: string, maxBytes = DEFAULT_WINDOW): TranscriptTail {
  const stat = fs.statSync(file);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(file, "r");
  let text: string;
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    text = buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }

  const rawLines = text.split("\n");
  if (start > 0) rawLines.shift(); // first line is (likely) partial — drop it

  const lines: unknown[] = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      // partial or corrupt line — skip
    }
  }
  return { lines, size: stat.size, complete: start === 0 };
}

interface RawLine {
  type?: string;
  timestamp?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  aiTitle?: string;
  message?: { role?: string; content?: unknown };
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
}

/**
 * Reduce raw transcript lines to renderable messages: user text, assistant
 * text, tool_use names as chips. Skips sidechain (subagent) lines, meta
 * lines, non-message types, and user lines that only carry tool_results.
 *
 * A subagent's OWN transcript is entirely sidechain lines, so pass
 * `includeSidechain: true` when rendering one of those.
 */
export function parseThread(
  rawLines: unknown[],
  limit = 80,
  opts: { includeSidechain?: boolean } = {},
): ThreadMessage[] {
  const out: ThreadMessage[] = [];
  for (const raw of rawLines) {
    const line = raw as RawLine;
    if (line.type !== "user" && line.type !== "assistant") continue;
    if ((line.isSidechain && !opts.includeSidechain) || line.isMeta) continue;
    const content = line.message?.content;

    let text = "";
    const tools: string[] = [];
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      let hasNonToolResult = false;
      for (const block of content as ContentBlock[]) {
        if (block.type === "text" && block.text) {
          text += (text ? "\n" : "") + block.text;
          hasNonToolResult = true;
        } else if (block.type === "tool_use") {
          if (block.name) tools.push(block.name);
          hasNonToolResult = true;
        }
        // tool_result blocks are carriers — never rendered
      }
      if (!hasNonToolResult) continue;
    } else {
      continue;
    }
    if (!text.trim() && tools.length === 0) continue;

    out.push({
      role: line.type,
      text: text.trim(),
      tools,
      ts: line.timestamp ?? null,
    });
  }
  return out.slice(-limit);
}

/** Last ai-title seen in the tail window, if any. */
export function extractAiTitle(rawLines: unknown[]): string | null {
  let title: string | null = null;
  for (const raw of rawLines) {
    const line = raw as RawLine;
    if (line.type === "ai-title" && line.aiTitle) title = line.aiTitle;
  }
  return title;
}

/** Count how many renderable messages the tail window holds (before limit). */
export function countRenderable(rawLines: unknown[]): number {
  return parseThread(rawLines, Number.MAX_SAFE_INTEGER).length;
}

/**
 * First user text in a transcript — for a subagent transcript this is the
 * task/prompt it was given. Reads sidechain lines (subagents are all sidechain).
 */
export function firstUserText(rawLines: unknown[]): string {
  for (const raw of rawLines) {
    const line = raw as RawLine;
    if (line.type !== "user") continue;
    const content = line.message?.content;
    if (typeof content === "string") {
      if (content.trim()) return content.trim();
    } else if (Array.isArray(content)) {
      for (const block of content as ContentBlock[]) {
        if (block.type === "text" && block.text?.trim()) return block.text.trim();
      }
    }
  }
  return "";
}
