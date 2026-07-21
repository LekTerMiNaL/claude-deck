import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  mergeStatusLine,
  statusLineState,
  stripStatusLine,
  ourCommand,
  run,
} from "../../bin/setup-statusline.js";

const OURS = "node /pkg/scripts/statusline-bridge.mjs";

describe("pure helpers", () => {
  it("mergeStatusLine sets our statusLine and preserves every other key", () => {
    const next = mergeStatusLine({ model: "opus", tui: "fullscreen" }, OURS);
    expect(next).toEqual({
      model: "opus",
      tui: "fullscreen",
      statusLine: { type: "command", command: OURS },
    });
  });

  it("statusLineState detects absent / ours / foreign", () => {
    expect(statusLineState({}, OURS)).toBe("absent");
    expect(statusLineState({ statusLine: "x" }, OURS)).toBe("absent"); // not an object
    expect(statusLineState({ statusLine: { type: "command", command: OURS } }, OURS)).toBe("ours");
    expect(statusLineState({ statusLine: { type: "command", command: "node other.js" } }, OURS)).toBe("foreign");
  });

  it("stripStatusLine only removes when it's ours", () => {
    expect(stripStatusLine({ a: 1, statusLine: { command: OURS } }, OURS)).toEqual({ a: 1 });
    const foreign = { a: 1, statusLine: { command: "node other.js" } };
    expect(stripStatusLine(foreign, OURS)).toEqual(foreign); // unchanged
  });
});

describe("run() integration (temp claude dir)", () => {
  let dir: string;
  let settings: string;
  const NOW = new Date(2026, 6, 21, 21, 40, 5);
  const silent = { now: NOW, log: () => {}, err: () => {} };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cd-setup-"));
    settings = path.join(dir, "settings.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.CLAUDE_DECK_CLAUDE_DIR;
  });

  const readSettings = () => JSON.parse(fs.readFileSync(settings, "utf8"));
  const baks = () => fs.readdirSync(dir).filter((f) => f.includes(".bak-"));

  it("adds the statusLine, preserving existing keys, and backs up when a file existed", () => {
    fs.writeFileSync(settings, JSON.stringify({ model: "opus" }, null, 2));
    const code = run(["--claude-dir", dir], silent);
    expect(code).toBe(0);
    const s = readSettings();
    expect(s.model).toBe("opus");
    expect(s.statusLine.command).toBe(ourCommand());
    expect(baks()).toHaveLength(1);
  });

  it("creates settings.json when none existed (no backup)", () => {
    const code = run(["--claude-dir", dir], silent);
    expect(code).toBe(0);
    expect(readSettings().statusLine.type).toBe("command");
    expect(baks()).toHaveLength(0);
  });

  it("second run is a no-op: 'already set up', no extra backup", () => {
    run(["--claude-dir", dir], silent);
    const before = baks().length;
    const code = run(["--claude-dir", dir], silent);
    expect(code).toBe(0);
    expect(baks().length).toBe(before); // no new backup written
  });

  it("refuses a foreign statusLine without --force (no write), overwrites with --force", () => {
    fs.writeFileSync(settings, JSON.stringify({ statusLine: { type: "command", command: "node theirs.js" } }));
    const refused = run(["--claude-dir", dir], silent);
    expect(refused).toBe(1);
    expect(readSettings().statusLine.command).toBe("node theirs.js"); // untouched

    const forced = run(["--claude-dir", dir, "--force"], silent);
    expect(forced).toBe(0);
    expect(readSettings().statusLine.command).toBe(ourCommand());
    expect(baks()).toHaveLength(1); // --force backed up first
  });

  it("--revert removes ours; is a no-op when not ours", () => {
    run(["--claude-dir", dir], silent);
    const code = run(["--claude-dir", dir, "--revert"], silent);
    expect(code).toBe(0);
    expect(readSettings().statusLine).toBeUndefined();

    const again = run(["--claude-dir", dir, "--revert"], silent);
    expect(again).toBe(0); // nothing to do
  });

  it("--print writes nothing at all", () => {
    let out = "";
    const code = run(["--claude-dir", dir, "--print"], { ...silent, log: (m) => (out += m) });
    expect(code).toBe(0);
    expect(fs.existsSync(settings)).toBe(false);
    expect(out).toContain('"type": "command"');
  });

  it("malformed settings.json is never written to (hard stop)", () => {
    fs.writeFileSync(settings, "{ not json");
    const code = run(["--claude-dir", dir], silent);
    expect(code).toBe(1);
    expect(fs.readFileSync(settings, "utf8")).toBe("{ not json"); // untouched
    expect(baks()).toHaveLength(0);
  });
});
