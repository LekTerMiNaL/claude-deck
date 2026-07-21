import { test, expect } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Smoke-tests the real `claude-deck` bin (no browser page involved).
const BIN = path.resolve("bin/claude-deck.js");
const PORT = 5761;
const ENV = {
  ...process.env,
  CLAUDE_DECK_CLAUDE_DIR: path.resolve("e2e/fixtures/claude-home"),
  CLAUDE_DECK_CONFIG_DIR: path.resolve("e2e/.tmp-config-bin"),
  CLAUDE_DECK_FAKE_PIDS: "111111,222222",
};

test("bin starts the server, serves API + app, and dies on SIGTERM", async () => {
  // spawn from an unrelated cwd — the way `npx claude-deck` runs in the wild
  const child = spawn("node", [BIN, "--port", String(PORT), "--no-open"], { env: ENV, cwd: os.tmpdir() });
  try {
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/live`);
        ready = res.ok;
      } catch {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    expect(ready).toBe(true);

    const live = (await (await fetch(`http://127.0.0.1:${PORT}/api/live`)).json()) as {
      sessions: unknown[];
    };
    expect(live.sessions.length).toBeGreaterThan(0); // fixture world visible

    const html = await (await fetch(`http://127.0.0.1:${PORT}/`)).text();
    expect(html).toContain("claude-deck"); // built frontend served
  } finally {
    const exited = new Promise((resolve) => child.on("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
});

test("--version prints the package version, --help documents flags", () => {
  const version = execFileSync("node", [BIN, "--version"], { encoding: "utf8" }).trim();
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);

  const help = execFileSync("node", [BIN, "--help"], { encoding: "utf8" });
  expect(help).toContain("--port");
  expect(help).toContain("--no-open");
  expect(help).toContain("127.0.0.1");
});

test("unknown flags exit non-zero with usage", () => {
  expect(() => execFileSync("node", [BIN, "--bogus"], { encoding: "utf8", stdio: "pipe" })).toThrow();
});

test("setup-statusline subcommand dispatches: --print emits the snippet, writes nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cd-bin-setup-"));
  try {
    const out = execFileSync("node", [BIN, "setup-statusline", "--print", "--claude-dir", dir], { encoding: "utf8" });
    expect(out).toContain('"statusLine"');
    expect(out).toContain("statusline-bridge.mjs");
    expect(fs.existsSync(path.join(dir, "settings.json"))).toBe(false); // --print never writes

    // real write path through the bin, into a throwaway dir
    const code = execFileSync("node", [BIN, "setup-statusline", "--claude-dir", dir], { encoding: "utf8" });
    expect(code).toContain("restart Claude Code");
    const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"));
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain("statusline-bridge.mjs");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
