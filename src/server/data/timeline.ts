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

export interface HistorySearchResult {
  entries: TimelineEntry[];
  /** Matches in the whole file, even beyond `limit`. */
  total: number;
}

/**
 * Walk history.jsonl newest-first (it's append-only), optionally filtering by
 * a case-insensitive substring of the prompt. Substring — not word-boundary —
 * matching, because Thai has no spaces between words. `entries` is capped by
 * `limit`; `total` keeps counting all matches for "showing X of N".
 */
export function historyEntries(opts: { query?: string; limit: number }): HistorySearchResult {
  const file = path.join(claudeDir(), "history.jsonl");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return { entries: [], total: 0 };
  }
  const q = opts.query?.toLowerCase() ?? "";
  const config = readConfig();
  const entries: TimelineEntry[] = [];
  let total = 0;
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
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
    if (q && !display.toLowerCase().includes(q)) continue;
    total++;
    if (entries.length < opts.limit) {
      entries.push({
        ts: timestamp,
        display,
        project,
        projectName: path.basename(project),
        displayPath: shortenHome(project),
        sessionId,
        inDeck: config.projects.includes(project),
      });
    } else if (!q) {
      break; // timeline mode: nothing past limit is needed, stop early
    }
  }
  // history.jsonl is normally time-ordered; enforce it in case of clock skew
  entries.sort((a, b) => b.ts - a.ts);
  return { entries, total };
}

/** Most recent prompts across ALL projects, newest first. */
export function timeline(limit = 100): TimelineEntry[] {
  return historyEntries({ limit }).entries;
}
