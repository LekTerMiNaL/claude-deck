import fs from "node:fs";
import path from "node:path";
import { claudeDir, configDir, shortenHome } from "./paths.js";
import { knownRealPaths } from "./scan.js";
import { SESSION_ID_RE } from "./project-sessions.js";

/**
 * Full-text cache: transcripts are huge (100+ MB) but their renderable text is
 * ~2% of that, and the files are append-only. We keep one small .jsonl of
 * extracted messages per session under <configDir>/text-index and only parse
 * bytes we haven't seen before. Searching is then a substring scan over ~MBs —
 * no inverted index, which is also exactly what Thai text needs.
 */

export interface IndexedMessage {
  ts: string | null;
  role: "user" | "assistant";
  text: string;
}

export interface DeepMatch {
  project: string | null;
  projectName: string;
  displayPath: string | null;
  sessionId: string;
  role: "user" | "assistant";
  ts: string | null;
  snippet: string;
}

export interface RefreshStats {
  files: number;
  newMessages: number;
  ms: number;
}

interface FileMeta {
  offset: number;
  size: number;
  mtimeMs: number;
}

const SNIPPET_AROUND = 90;

function indexDir(): string {
  return path.join(configDir(), "text-index");
}

/** Extract renderable messages from raw jsonl text (same skip rules as the UI thread). */
export function extractMessages(raw: string): IndexedMessage[] {
  const out: IndexedMessage[] = [];
  for (const line of raw.split("\n")) {
    // cheap pre-filter before JSON.parse — most lines aren't messages
    if (!line.includes('"user"') && !line.includes('"assistant"')) continue;
    let o: {
      type?: string;
      isSidechain?: boolean;
      isMeta?: boolean;
      timestamp?: string;
      message?: { content?: unknown };
    };
    try {
      o = JSON.parse(line) as typeof o;
    } catch {
      continue;
    }
    if (o.type !== "user" && o.type !== "assistant") continue;
    if (o.isSidechain || o.isMeta) continue;
    const content = o.message?.content;
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      for (const b of content as { type?: string; text?: string }[]) {
        if (b.type === "text" && b.text) text += (text ? "\n" : "") + b.text;
      }
    }
    text = text.trim();
    if (!text) continue;
    out.push({ ts: o.timestamp ?? null, role: o.type, text });
  }
  return out;
}

function readMeta(metaFile: string): FileMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaFile, "utf8")) as FileMeta;
  } catch {
    return null;
  }
}

/**
 * Bring one session's cache up to date. Returns how many messages were added.
 * Append-only source → parse only bytes past the stored offset; a shrunken
 * file (rewrite) triggers a full rebuild.
 */
export function refreshSessionIndex(sourceFile: string, outBase: string): number {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(sourceFile);
  } catch {
    return 0;
  }
  const metaFile = `${outBase}.meta.json`;
  const cacheFile = `${outBase}.jsonl`;
  const meta = readMeta(metaFile);

  if (meta && meta.size === stat.size && meta.mtimeMs === stat.mtimeMs) return 0; // unchanged

  let start = meta && stat.size >= meta.size ? meta.offset : 0;
  if (start === 0) fs.rmSync(cacheFile, { force: true }); // full (re)build

  const fd = fs.openSync(sourceFile, "r");
  let raw: string;
  try {
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    raw = buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }

  // don't index a trailing partial line — leave it for the next refresh
  const lastNewline = raw.lastIndexOf("\n");
  const complete = lastNewline === -1 ? "" : raw.slice(0, lastNewline + 1);
  const nextOffset = start + Buffer.byteLength(complete);

  const messages = extractMessages(complete);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  if (messages.length > 0) {
    fs.appendFileSync(cacheFile, messages.map((m) => JSON.stringify(m)).join("\n") + "\n");
  } else if (!fs.existsSync(cacheFile)) {
    fs.writeFileSync(cacheFile, "");
  }
  fs.writeFileSync(metaFile, JSON.stringify({ offset: nextOffset, size: stat.size, mtimeMs: stat.mtimeMs }));
  return messages.length;
}

/** Refresh the whole corpus (incremental — cheap when nothing changed). */
export function refreshTextIndex(): RefreshStats {
  const t0 = Date.now();
  const projectsDir = path.join(claudeDir(), "projects");
  let files = 0;
  let newMessages = 0;
  let encodedDirs: string[];
  try {
    encodedDirs = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    encodedDirs = [];
  }
  for (const encoded of encodedDirs) {
    const dir = path.join(projectsDir, encoded);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      const sessionId = e.name.replace(/\.jsonl$/, "");
      if (!SESSION_ID_RE.test(sessionId)) continue;
      files++;
      newMessages += refreshSessionIndex(path.join(dir, e.name), path.join(indexDir(), encoded, sessionId));
    }
  }
  return { files, newMessages, ms: Date.now() - t0 };
}

function snippetAround(text: string, at: number, qLen: number): string {
  const start = Math.max(0, at - SNIPPET_AROUND);
  const end = Math.min(text.length, at + qLen + SNIPPET_AROUND);
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${clean(text.slice(start, end))}${end < text.length ? "…" : ""}`;
}

/** Substring scan over the cache, newest transcript-order first. */
export function deepSearch(query: string, limit = 50): { matches: DeepMatch[]; total: number } {
  const q = query.toLowerCase();
  const byEncoded = knownRealPaths();
  const matches: DeepMatch[] = [];
  let total = 0;

  let encodedDirs: string[];
  try {
    encodedDirs = fs
      .readdirSync(indexDir(), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { matches: [], total: 0 };
  }

  for (const encoded of encodedDirs) {
    const dir = path.join(indexDir(), encoded);
    const real = byEncoded.get(encoded) ?? null;
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const sessionId = f.replace(/\.jsonl$/, "");
      let raw: string;
      try {
        raw = fs.readFileSync(path.join(dir, f), "utf8");
      } catch {
        continue;
      }
      for (const line of raw.split("\n")) {
        if (!line) continue;
        let m: IndexedMessage;
        try {
          m = JSON.parse(line) as IndexedMessage;
        } catch {
          continue;
        }
        const at = m.text.toLowerCase().indexOf(q);
        if (at === -1) continue;
        total++;
        matches.push({
          project: real,
          projectName: real ? path.basename(real) : encoded,
          displayPath: real ? shortenHome(real) : null,
          sessionId,
          role: m.role,
          ts: m.ts,
          snippet: snippetAround(m.text, at, q.length),
        });
      }
    }
  }

  matches.sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""));
  return { matches: matches.slice(0, limit), total };
}
