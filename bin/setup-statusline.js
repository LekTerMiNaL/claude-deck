// `claude-deck setup-statusline` — wire the statusline bridge into
// ~/.claude/settings.json so the usage bars light up. Plain node, no deps.
//
// This is the ONE sanctioned write to ~/.claude: user-invoked only, backs up
// first, refuses to clobber a foreign statusLine without --force. The
// claude-deck SERVER never writes ~/.claude — only this CLI a human ran does.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the bundled statusline bridge (package root). */
export function bridgePath() {
  return path.join(HERE, "..", "scripts", "statusline-bridge.mjs");
}

/** The command string we install as the statusLine. */
export function ourCommand(bridge = bridgePath()) {
  return `node ${bridge}`;
}

/** Claude dir — env override wins (tests + non-default installs). */
export function claudeDir() {
  return process.env.CLAUDE_DECK_CLAUDE_DIR ?? path.join(os.homedir(), ".claude");
}

/** Pure: new settings object with our statusLine, all other keys preserved. */
export function mergeStatusLine(settings, command) {
  return { ...settings, statusLine: { type: "command", command } };
}

/** Pure: "absent" | "ours" | "foreign". */
export function statusLineState(settings, command) {
  const sl = settings && settings.statusLine;
  if (!sl || typeof sl !== "object") return "absent";
  return sl.command === command ? "ours" : "foreign";
}

/** Pure: remove statusLine only when it's ours; otherwise return unchanged. */
export function stripStatusLine(settings, command) {
  if (statusLineState(settings, command) !== "ours") return settings;
  const next = { ...settings };
  delete next.statusLine;
  return next;
}

/** The paste-ready snippet (matches the server's usageSetup snippet shape). */
export function snippet(command = ourCommand()) {
  return `"statusLine": {\n  "type": "command",\n  "command": "${command}"\n}`;
}

function parseArgs(argv) {
  const opts = { print: false, force: false, revert: false, help: false, claudeDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--print" || a === "--dry-run") opts.print = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--revert") opts.revert = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--claude-dir") opts.claudeDir = argv[++i];
    else throw new Error(`unknown option: ${a}`);
  }
  return opts;
}

const HELP = `claude-deck setup-statusline — turn on the usage bars

usage: claude-deck setup-statusline [options]

Adds a statusLine command to ~/.claude/settings.json that feeds claude-deck's
usage bars (and gives you a compact terminal statusline). Backs up settings.json
first and never clobbers an existing statusLine without --force.

options:
      --print, --dry-run   print the snippet + target path, write nothing
      --force              overwrite an existing (foreign) statusLine
      --revert             remove the statusLine we added
      --claude-dir <path>  use this instead of ~/.claude
  -h, --help               this help`;

function timestamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function writeAtomic(file, content) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

/**
 * Do the work. Returns a process exit code (0 = success/no-op, non-zero =
 * refused/error). `now` is injectable for deterministic backup names in tests.
 */
export function run(argv, { now = new Date(), log = console.log, err = console.error } = {}) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    err(String(e instanceof Error ? e.message : e));
    err(HELP);
    return 2;
  }
  if (opts.help) {
    log(HELP);
    return 0;
  }

  if (opts.claudeDir) process.env.CLAUDE_DECK_CLAUDE_DIR = opts.claudeDir;
  const dir = claudeDir();
  const settingsPath = path.join(dir, "settings.json");
  const command = ourCommand();

  if (opts.print) {
    log(`Add this to ${settingsPath}:\n\n${snippet(command)}\n\nthen restart Claude Code.`);
    return 0;
  }

  // read settings — missing is fine ({}), malformed is a hard stop (never write)
  let settings = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      err(`${settingsPath} is not valid JSON — refusing to touch it. Fix it or paste manually:\n\n${snippet(command)}`);
      return 1;
    }
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      err(`${settingsPath} is not a JSON object — refusing to touch it.`);
      return 1;
    }
  }

  const state = statusLineState(settings, command);
  const backup = () => {
    if (!existed) return null;
    const bak = `${settingsPath}.bak-${timestamp(now)}`;
    fs.copyFileSync(settingsPath, bak);
    return bak;
  };
  const finish = (next, msg) => {
    fs.mkdirSync(dir, { recursive: true });
    const bak = backup();
    writeAtomic(settingsPath, JSON.stringify(next, null, 2) + "\n");
    log(msg);
    if (bak) log(`backed up → ${path.basename(bak)}`);
    log("restart Claude Code to apply.");
    return 0;
  };

  if (opts.revert) {
    if (state !== "ours") {
      log("no claude-deck statusLine to remove — nothing to do.");
      return 0;
    }
    return finish(stripStatusLine(settings, command), "removed claude-deck's statusLine.");
  }

  if (state === "ours") {
    log("already set up ✓ — claude-deck's statusLine is in place.");
    return 0;
  }
  if (state === "foreign" && !opts.force) {
    err(`a different statusLine is already configured:\n  ${settings.statusLine.command}`);
    err(`\nre-run with --force to overwrite it, or merge by hand — add:\n\n${snippet(command)}`);
    return 1;
  }
  return finish(mergeStatusLine(settings, command), `added claude-deck's statusLine → ${command}`);
}
