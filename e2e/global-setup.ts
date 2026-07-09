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

  // rocket-shop gets a realistic transcript: user/assistant turns, tool chips,
  // plus every noise shape the parser must skip (carrier, sidechain, snapshot).
  const J = (o: object) => JSON.stringify(o);
  const rocketThread = [
    J({ type: "user", timestamp: "2026-07-01T21:42:00Z", message: { role: "user", content: "build the checkout page" } }),
    J({
      type: "assistant",
      timestamp: "2026-07-01T21:43:00Z",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "On it — wiring the cart to the payment form now." },
          { type: "tool_use", name: "Read", input: {} },
          { type: "tool_use", name: "Edit", input: {} },
        ],
      },
    }),
    J({ type: "user", timestamp: "2026-07-01T21:44:00Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] } }),
    J({ type: "user", isSidechain: true, timestamp: "2026-07-01T21:44:30Z", message: { role: "user", content: "subagent noise — must not render" } }),
    J({ type: "file-history-snapshot", messageId: "m1", snapshot: {} }),
    J({ type: "ai-title", aiTitle: "Fix rocket engine overheating", sessionId: SID_ROCKET }),
    J({ type: "user", timestamp: "2026-07-02T09:00:00Z", message: { role: "user", content: "fix rocket engine overheating bug" } }),
    J({
      type: "assistant",
      timestamp: "2026-07-02T09:01:00Z",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Coolant loop was saturating — capped the burn rate and added a regression test." },
          { type: "tool_use", name: "Bash", input: {} },
        ],
      },
    }),
  ];
  // second rocket session with no history lines — title must come from ai-title
  const SID_ROCKET2 = "44444444-dddd-4ddd-8ddd-444444444444";
  const rocket2Thread = [
    J({ type: "user", timestamp: "2026-06-20T10:00:00Z", message: { role: "user", content: "prototype the landing legs" } }),
    J({ type: "ai-title", aiTitle: "Prototype landing legs", sessionId: SID_ROCKET2 }),
  ];
  const moonThread = [
    J({ type: "user", timestamp: "2026-07-06T08:00:00Z", message: { role: "user", content: "write a post about moon dust" } }),
    J({
      type: "assistant",
      timestamp: "2026-07-06T08:01:00Z",
      message: { role: "assistant", content: [{ type: "text", text: "Drafted 600 words on regolith static cling." }] },
    }),
  ];

  const transcripts: Array<[string, string, string[]]> = [
    [rocket, SID_ROCKET, rocketThread],
    [rocket, SID_ROCKET2, rocket2Thread],
    [moon, SID_MOON, moonThread],
    [ghost, SID_GHOST, [J({ type: "user", timestamp: "2026-06-17T08:00:00Z", message: { role: "user", content: "old ghost experiment" } })]],
  ];
  for (const [proj, sid, lines] of transcripts) {
    const dir = path.join(claudeDir, "projects", enc(proj));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${sid}.jsonl`), lines.join("\n") + "\n");
  }

  // rocket-shop's live session spawned subagents: 2 Task agents + a workflow of 2.
  // Every line isSidechain (that's what a subagent transcript looks like on disk).
  const sJ = (o: object) => JSON.stringify({ isSidechain: true, ...o });
  const sUser = (text: string) => sJ({ type: "user", timestamp: "2026-07-02T09:05:00Z", message: { role: "user", content: text } });
  const sAsst = (blocks: object[]) =>
    sJ({ type: "assistant", timestamp: "2026-07-02T09:06:00Z", message: { role: "assistant", content: blocks } });

  const subBase = path.join(claudeDir, "projects", enc(rocket), SID_ROCKET, "subagents");
  const writeAgent = (rel: string, agentId: string, meta: object, lines: string[]) => {
    const d = path.join(subBase, rel);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, `${agentId}.jsonl`), lines.join("\n") + "\n");
    fs.writeFileSync(path.join(d, `${agentId}.meta.json`), JSON.stringify(meta));
  };
  writeAgent(".", "agent-a001", { agentType: "builder", description: "Build the checkout form" }, [
    sUser("Build the checkout form with the payment fields"),
    sAsst([{ type: "text", text: "Built the form and wired validation." }, { type: "tool_use", name: "Edit", input: {} }]),
  ]);
  writeAgent(".", "agent-a002", { agentType: "reviewer", description: "Review the checkout form" }, [
    sUser("Review the checkout form for bugs"),
    sAsst([{ type: "text", text: "Found one edge case with empty carts; otherwise solid." }]),
  ]);
  writeAgent("workflows/wf_check01", "agent-b001", { agentType: "workflow-subagent" }, [
    sUser("Find correctness bugs in the burn-rate cap"),
    sAsst([{ type: "tool_use", name: "Grep", input: {} }]),
  ]);
  writeAgent("workflows/wf_check01", "agent-b002", { agentType: "workflow-subagent" }, [
    sUser("Verify the reported burn-rate bug is real"),
    sAsst([{ type: "text", text: "Confirmed — reproduces at throttle 0." }]),
  ]);

  // fake `claude` CLI for summary e2e: records each call, echoes a canned summary
  const fakeBin = path.join(e2eDir, "fixtures", "fake-claude.sh");
  const callLog = path.join(e2eDir, ".tmp-claude-calls");
  fs.rmSync(callLog, { force: true });
  fs.writeFileSync(
    fakeBin,
    `#!/bin/sh\necho "call" >> "${callLog}"\necho "สรุป: ทำหน้า checkout และแก้บั๊กเครื่องยนต์ร้อนเกินเสร็จแล้ว เหลือเก็บงานทดสอบ"\n`,
  );
  fs.chmodSync(fakeBin, 0o755);

  // fake open-terminal sink
  fs.rmSync(path.join(e2eDir, ".tmp-open-log"), { force: true });

  const sessions = [
    { pid: 111111, sessionId: SID_ROCKET, cwd: rocket, name: "rocket-shop-7", status: "busy", startedAt: now - 8_040_000, updatedAt: now },
    { pid: 222222, sessionId: SID_MOON, cwd: moon, name: "moon-blog-2", status: "idle", startedAt: now - 3_600_000, updatedAt: now },
    { pid: 999999, sessionId: SID_GHOST, cwd: ghost, name: "dead-one", status: "busy", startedAt: now, updatedAt: now },
  ];
  for (const s of sessions) {
    fs.writeFileSync(path.join(claudeDir, "sessions", `${s.pid}.json`), JSON.stringify(s));
  }
}
