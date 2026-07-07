import os from "node:os";
import path from "node:path";

/** Directory claude-deck reads Claude Code data from. NEVER written to. */
export function claudeDir(): string {
  return process.env.CLAUDE_DECK_CLAUDE_DIR ?? path.join(os.homedir(), ".claude");
}

/** Directory claude-deck stores its own config in — the only place we write. */
export function configDir(): string {
  return process.env.CLAUDE_DECK_CONFIG_DIR ?? path.join(os.homedir(), ".claude-deck");
}

export function serverPort(): number {
  const p = Number(process.env.CLAUDE_DECK_PORT);
  return Number.isInteger(p) && p > 0 ? p : 5757;
}

/**
 * How Claude Code encodes a project path into a directory name under
 * ~/.claude/projects: every non-alphanumeric character becomes "-".
 * Lossy — "gyo-demo" and "gyo/demo" collide — so real paths must be
 * recovered by matching known real paths, never by decoding.
 */
export function encodeProjectPath(realPath: string): string {
  return realPath.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Expand a leading "~" to the home directory. */
export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Shorten a home-prefixed absolute path back to "~/..." for display. */
export function shortenHome(p: string): string {
  const home = os.homedir();
  if (p === home) return "~";
  if (p.startsWith(home + path.sep)) return "~" + p.slice(home.length);
  return p;
}
