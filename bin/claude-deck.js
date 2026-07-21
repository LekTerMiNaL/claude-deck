#!/usr/bin/env node
// claude-deck launcher: starts the local server and opens the browser.
// No dependencies — plain node. See docs/spec/phase-6-npx.md.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Parse CLI args. Pure — throws on invalid input. */
export function parseArgs(argv) {
  const opts = { port: 5757, open: true, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port" || a === "-p") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0 || v > 65535) throw new Error(`invalid port: ${argv[i]}`);
      opts.port = v;
    } else if (a === "--no-open") {
      opts.open = false;
    } else if (a === "--help" || a === "-h") {
      opts.help = true;
    } else if (a === "--version" || a === "-v") {
      opts.version = true;
    } else {
      throw new Error(`unknown option: ${a}`);
    }
  }
  return opts;
}

/** Command that opens `url` in the default browser on `platform`. Pure. */
export function openCommand(platform, url) {
  if (platform === "darwin") return ["open", url];
  if (platform === "win32") return ["cmd", "/c", "start", "", url];
  return ["xdg-open", url];
}

function pkg() {
  return JSON.parse(fs.readFileSync(path.join(HERE, "..", "package.json"), "utf8"));
}

const HELP = `claude-deck — local dashboard for Claude Code sessions

usage: claude-deck [options]

options:
  -p, --port <n>   port to listen on (default 5757)
      --no-open    don't open the browser
  -v, --version    print version
  -h, --help       this help

commands:
  setup-statusline [--print|--dry-run] [--force] [--revert]
                   wire the usage bars into ~/.claude/settings.json

The server binds 127.0.0.1 only and reads ~/.claude strictly read-only.
(The setup-statusline command is the one exception — a user-invoked, backup-first
write to settings.json. The server itself never writes ~/.claude.)`;

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function main() {
  const raw = process.argv.slice(2);
  if (raw[0] === "setup-statusline") {
    const { run } = await import("./setup-statusline.js");
    process.exit(run(raw.slice(1)));
  }

  let opts;
  try {
    opts = parseArgs(raw);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    console.error(HELP);
    process.exit(2);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.version) {
    console.log(pkg().version);
    return;
  }

  const serverEntry = path.join(HERE, "..", "dist", "server", "index.js");
  if (!fs.existsSync(serverEntry)) {
    console.error("dist/server/index.js not found — run `npm run build` first.");
    process.exit(1);
  }

  const child = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, CLAUDE_DECK_PORT: String(opts.port) },
    stdio: "inherit",
    // the server resolves dist/web relative to its cwd — pin it to the package
    // root so `npx claude-deck` works from any directory
    cwd: path.join(HERE, ".."),
  });
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => child.kill(sig));
  }
  child.on("exit", (code) => process.exit(code ?? 0));

  const url = `http://127.0.0.1:${opts.port}`;
  if (await waitForServer(`${url}/api/live`)) {
    if (opts.open) {
      const [cmd, ...args] = openCommand(process.platform, url);
      spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
    }
  } else {
    console.error("server did not become ready — see output above.");
  }
}

// only run when executed directly (tests import the helpers above)
const isDirectRun =
  process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
