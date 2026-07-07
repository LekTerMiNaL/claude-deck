import fs from "node:fs";
import path from "node:path";
import { claudeDir, encodeProjectPath } from "./paths.js";
import { readHistoryIndex } from "./history.js";
import { readConfig } from "./config.js";

export interface ScannedProject {
  /** Folder basename of the real path (or the encoded dir name for unresolved orphans). */
  name: string;
  /** Real absolute path when recovered, null when only the encoded name is known. */
  path: string | null;
  encodedName: string;
  sessionCount: number;
  lastTs: number;
  lastPrompt: string;
  /** True when the project folder no longer exists on disk — history only. */
  missing: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Count transcript files directly in a project dir (subagent subdirs + memory/ ignored). */
function countSessionFiles(dir: string): number {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl") && UUID_RE.test(e.name.replace(/\.jsonl$/, "")))
      .length;
  } catch {
    return 0;
  }
}

function listRootChildren(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => path.join(root, e.name));
  } catch {
    return [];
  }
}

/**
 * Recover real paths for the encoded dirs under ~/.claude/projects.
 * The encoding is lossy, so we match encoded forms of every real path we
 * know about: history.jsonl paths, deck projects, and subfolders of
 * registered roots.
 */
export function knownRealPaths(): Map<string, string> {
  const config = readConfig();
  const history = readHistoryIndex();
  const candidates = new Set<string>([
    ...history.projects.keys(),
    ...config.projects,
    ...config.roots.flatMap(listRootChildren),
    ...config.roots,
  ]);
  const byEncoded = new Map<string, string>();
  for (const real of candidates) {
    byEncoded.set(encodeProjectPath(real), real);
  }
  return byEncoded;
}

/** Scan ~/.claude/projects and resolve each encoded dir to what we know about it. */
export function scanProjects(): ScannedProject[] {
  const projectsDir = path.join(claudeDir(), "projects");
  let entries: string[];
  try {
    entries = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    entries = [];
  }

  const byEncoded = knownRealPaths();
  const history = readHistoryIndex();
  const results: ScannedProject[] = [];

  for (const encodedName of entries) {
    const realPath = byEncoded.get(encodedName) ?? null;
    const hist = realPath ? history.projects.get(realPath) : undefined;
    const sessionCount = countSessionFiles(path.join(projectsDir, encodedName));
    if (sessionCount === 0 && !hist) continue; // e.g. bare memory/-only dirs
    const missing = realPath === null || !fs.existsSync(realPath);
    results.push({
      name: realPath ? path.basename(realPath) : encodedName,
      path: realPath,
      encodedName,
      sessionCount,
      lastTs: hist?.lastTs ?? 0,
      lastPrompt: hist?.lastPrompt ?? "",
      missing,
    });
  }

  return results.sort((a, b) => b.lastTs - a.lastTs);
}

export interface RootChild {
  name: string;
  path: string;
  hasHistory: boolean;
}

/** Subfolders of a registered root — addable even with no Claude history yet. */
export function rootChildren(root: string): RootChild[] {
  const history = readHistoryIndex();
  return listRootChildren(root)
    .map((p) => ({
      name: path.basename(p),
      path: p,
      hasHistory: history.projects.has(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
