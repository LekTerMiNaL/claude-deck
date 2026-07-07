import path from "node:path";
import fs from "node:fs";
import { claudeDir } from "./paths.js";
import { readConfig } from "./config.js";
import { shortenHome } from "./paths.js";

export interface TimelineEntry {
  ts: number;
  display: string;
  project: string;
  projectName: string;
  displayPath: string;
  sessionId: string;
  inDeck: boolean;
}

interface HistoryLine {
  display?: string;
  timestamp?: number;
  project?: string;
  sessionId?: string;
}

/**
 * Most recent prompts across ALL projects, newest first. Reads history.jsonl
 * directly (it's ordered append-only) instead of the aggregated index so we
 * keep individual entries.
 */
export function timeline(limit = 100): TimelineEntry[] {
  const file = path.join(claudeDir(), "history.jsonl");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const config = readConfig();
  const out: TimelineEntry[] = [];
  const lines = raw.split("\n");
  // append-only file → walk from the end, stop once we have enough
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    const line = lines[i];
    if (!line?.trim()) continue;
    let entry: HistoryLine;
    try {
      entry = JSON.parse(line) as HistoryLine;
    } catch {
      continue;
    }
    const { display, timestamp, project, sessionId } = entry;
    if (!display || !timestamp || !project || !sessionId) continue;
    out.push({
      ts: timestamp,
      display,
      project,
      projectName: path.basename(project),
      displayPath: shortenHome(project),
      sessionId,
      inDeck: config.projects.includes(project),
    });
  }
  // history.jsonl is normally time-ordered; enforce it in case of clock skew
  return out.sort((a, b) => b.ts - a.ts);
}
