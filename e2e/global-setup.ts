import fs from "node:fs";
import path from "node:path";

/**
 * Builds the synthesized claude-home fixture + a fresh config dir before the
 * e2e server starts. Everything here is fake — no real transcript data.
 *
 * Fixture world:
 *  - workspace/ acts as the fake "real" folders on disk
 *      workspace/rocket-shop   (has history, live busy session pid 111111)
 *      workspace/moon-blog     (has history)
 *      workspace/empty-lab     (no claude history at all — root-add candidate)
 *  - claude-home/projects/<encoded>/ transcripts for rocket-shop, moon-blog,
 *      and ghost-app (whose real folder does NOT exist → orphan)
 *  - claude-home/sessions/: pid 111111 (busy, rocket-shop), pid 222222 (idle,
 *      moon-blog), pid 999999 (dead — not in CLAUDE_DECK_FAKE_PIDS)
 */
export default function globalSetup(): void {
  const e2eDir = path.resolve("e2e");
  const claudeDir = path.join(e2eDir, "fixtures", "claude-home");
  const configDir = path.join(e2eDir, ".tmp-config");
  const workspace = path.join(e2eDir, "fixtures", "workspace");

  fs.rmSync(claudeDir, { recursive: true, force: true });
  fs.rmSync(configDir, { recursive: true, force: true });
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(path.join(claudeDir, "projects"), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, "sessions"), { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  const rocket = path.join(workspace, "rocket-shop");
  const moon = path.join(workspace, "moon-blog");
  const empty = path.join(workspace, "empty-lab");
  const ghost = path.join(workspace, "ghost-app"); // intentionally never created
  for (const p of [rocket, moon, empty]) fs.mkdirSync(p, { recursive: true });

  const enc = (p: string) => p.replace(/[^a-zA-Z0-9]/g, "-");
  const SID_ROCKET = "11111111-aaaa-4aaa-8aaa-111111111111";
  const SID_MOON = "22222222-bbbb-4bbb-8bbb-222222222222";
  const SID_GHOST = "33333333-cccc-4ccc-8ccc-333333333333";

  const now = Date.now();
  const history = [
    { display: "build the checkout page", timestamp: now - 7 * 86400_000, project: rocket, sessionId: SID_ROCKET },
    { display: "fix rocket engine overheating bug", timestamp: now - 120_000, project: rocket, sessionId: SID_ROCKET },
    { display: "write a post about moon dust", timestamp: now - 2 * 86400_000, project: moon, sessionId: SID_MOON },
    { display: "old ghost experiment", timestamp: now - 21 * 86400_000, project: ghost, sessionId: SID_GHOST },
  ];
  fs.writeFileSync(
    path.join(claudeDir, "history.jsonl"),
    history.map((h) => JSON.stringify({ ...h, pastedContents: {} })).join("\n") + "\n",
  );

  const transcriptLine = JSON.stringify({ type: "user", message: { role: "user", content: "fixture" } }) + "\n";
  for (const [proj, sid] of [
    [rocket, SID_ROCKET],
    [moon, SID_MOON],
    [ghost, SID_GHOST],
  ] as const) {
    const dir = path.join(claudeDir, "projects", enc(proj));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${sid}.jsonl`), transcriptLine);
  }

  const sessions = [
    { pid: 111111, sessionId: SID_ROCKET, cwd: rocket, name: "rocket-shop-7", status: "busy", startedAt: now - 8_040_000, updatedAt: now },
    { pid: 222222, sessionId: SID_MOON, cwd: moon, name: "moon-blog-2", status: "idle", startedAt: now - 3_600_000, updatedAt: now },
    { pid: 999999, sessionId: SID_GHOST, cwd: ghost, name: "dead-one", status: "busy", startedAt: now, updatedAt: now },
  ];
  for (const s of sessions) {
    fs.writeFileSync(path.join(claudeDir, "sessions", `${s.pid}.json`), JSON.stringify(s));
  }
}
