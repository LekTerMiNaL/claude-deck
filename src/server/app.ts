import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { liveCards, deckCards } from "./data/deck.js";
import { scanProjects, rootChildren } from "./data/scan.js";
import { readConfig, addProject, removeProject, addRoot } from "./data/config.js";
import { readHistoryIndex } from "./data/history.js";
import { expandHome, shortenHome } from "./data/paths.js";
import { listProjectSessions, transcriptFile, SESSION_ID_RE } from "./data/project-sessions.js";
import { tailReadJsonl, parseThread, countRenderable, extractAiTitle } from "./data/transcripts.js";
import {
  getCachedSummary,
  cacheSummary,
  buildSummaryInput,
  summaryPrompt,
  runClaudeSummary,
} from "./data/summary.js";
import { canOpenTerminal, openInTerminal } from "./data/terminal.js";
import { timeline, historyEntries } from "./data/timeline.js";
import { listSessionAgents, readSubagentThread, AGENT_ID_RE } from "./data/subagents.js";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/api/live", (c) => c.json({ sessions: liveCards() }));

  app.get("/api/deck", (c) => c.json({ projects: deckCards() }));

  app.get("/api/scan", (c) => {
    const config = readConfig();
    const live = liveCards();
    const items = scanProjects().map((p) => ({
      ...p,
      displayPath: p.path ? shortenHome(p.path) : null,
      inDeck: p.path !== null && config.projects.includes(p.path),
      live: p.path !== null && live.some((s) => s.cwd === p.path),
    }));
    return c.json({ items });
  });

  app.post("/api/deck", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { path?: string };
    if (!body.path?.trim()) return c.json({ error: "path is required" }, 400);
    const projectPath = expandHome(body.path.trim()).replace(/\/+$/, "");
    if (!projectPath.startsWith("/")) return c.json({ error: "path must be absolute" }, 400);

    const exists = fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
    const hasHistory = readHistoryIndex().projects.has(projectPath);
    if (!exists && !hasHistory) {
      return c.json({ error: "folder not found and no Claude history for it" }, 404);
    }
    if (readConfig().projects.includes(projectPath)) {
      return c.json({ error: "already in deck" }, 409);
    }
    addProject(projectPath);
    return c.json({ ok: true, path: projectPath }, 201);
  });

  app.delete("/api/deck", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { path?: string };
    if (!body.path) return c.json({ error: "path is required" }, 400);
    removeProject(body.path);
    return c.json({ ok: true });
  });

  app.get("/api/roots", (c) => {
    const config = readConfig();
    const roots = config.roots.map((root) => ({
      path: root,
      displayPath: shortenHome(root),
      children: rootChildren(root).map((ch) => ({
        ...ch,
        displayPath: shortenHome(ch.path),
        inDeck: config.projects.includes(ch.path),
      })),
    }));
    return c.json({ roots });
  });

  app.post("/api/roots", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { path?: string };
    if (!body.path?.trim()) return c.json({ error: "path is required" }, 400);
    const rootPath = expandHome(body.path.trim()).replace(/\/+$/, "");
    if (!rootPath.startsWith("/")) return c.json({ error: "path must be absolute" }, 400);
    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      return c.json({ error: "folder not found" }, 404);
    }
    addRoot(rootPath);
    return c.json({ ok: true, path: rootPath }, 201);
  });

  app.get("/api/project", (c) => {
    const projectPath = c.req.query("path");
    if (!projectPath) return c.json({ error: "path is required" }, 400);
    return c.json({
      project: {
        path: projectPath,
        displayPath: shortenHome(projectPath),
        name: path.basename(projectPath),
        missing: !fs.existsSync(projectPath),
      },
      sessions: listProjectSessions(projectPath),
    });
  });

  app.get("/api/session", (c) => {
    const projectPath = c.req.query("path");
    const id = c.req.query("id");
    if (!projectPath || !id) return c.json({ error: "path and id are required" }, 400);
    if (!SESSION_ID_RE.test(id)) return c.json({ error: "invalid session id" }, 400);

    const file = transcriptFile(projectPath, id);
    if (!fs.existsSync(file)) return c.json({ error: "transcript not found" }, 404);

    const tail = tailReadJsonl(file);
    const thread = parseThread(tail.lines);
    const renderable = countRenderable(tail.lines);
    const live = liveCards().find((s) => s.sessionId === id) ?? null;
    const hist = readHistoryIndex().projects.get(projectPath)?.sessions.get(id);

    return c.json({
      meta: {
        id,
        shortId: `${id.slice(0, 4)}…${id.slice(-3)}`,
        title: live?.name ?? extractAiTitle(tail.lines) ?? hist?.firstPrompt ?? id.slice(0, 8),
        status: live?.status ?? null,
        startedAt: live?.startedAt ?? hist?.firstTs ?? null,
        lastTs: hist?.lastTs ?? null,
        size: tail.size,
        promptCount: hist?.promptCount ?? 0,
        resumeCmd: `cd ${projectPath} && claude --resume ${id}`,
        /** thread is a tail window — true when older messages were cut off */
        truncated: !tail.complete,
        shownCount: thread.length,
        windowCount: renderable,
      },
      thread,
    });
  });

  app.get("/api/session/agents", (c) => {
    const projectPath = c.req.query("path");
    const id = c.req.query("id");
    if (!projectPath || !id) return c.json({ error: "path and id are required" }, 400);
    if (!SESSION_ID_RE.test(id)) return c.json({ error: "invalid session id" }, 400);
    return c.json(listSessionAgents(projectPath, id));
  });

  app.get("/api/subagent", (c) => {
    const projectPath = c.req.query("path");
    const id = c.req.query("id");
    const agent = c.req.query("agent");
    if (!projectPath || !id || !agent) return c.json({ error: "path, id and agent are required" }, 400);
    if (!SESSION_ID_RE.test(id)) return c.json({ error: "invalid session id" }, 400);
    if (!AGENT_ID_RE.test(agent)) return c.json({ error: "invalid agent id" }, 400);
    const thread = readSubagentThread(projectPath, id, agent);
    if (!thread) return c.json({ error: "subagent transcript not found" }, 404);
    return c.json({ thread });
  });

  app.get("/api/capabilities", (c) =>
    c.json({ openTerminal: canOpenTerminal(), summarize: true }),
  );

  app.get("/api/timeline", (c) => {
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || 100));
    return c.json({ entries: timeline(limit) });
  });

  app.get("/api/search", (c) => {
    const q = c.req.query("q")?.trim();
    if (!q) return c.json({ error: "q is required" }, 400);
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 50));
    const { entries, total } = historyEntries({ query: q, limit });
    return c.json({ entries, total });
  });

  app.post("/api/session/summary", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { path?: string; id?: string };
    const { path: projectPath, id } = body;
    if (!projectPath || !id) return c.json({ error: "path and id are required" }, 400);
    if (!SESSION_ID_RE.test(id)) return c.json({ error: "invalid session id" }, 400);
    const file = transcriptFile(projectPath, id);
    if (!fs.existsSync(file)) return c.json({ error: "transcript not found" }, 404);

    const tail = tailReadJsonl(file);
    const cached = getCachedSummary(id, tail.size);
    if (cached) return c.json({ summary: cached.summary, cached: true });

    const thread = parseThread(tail.lines);
    if (thread.length === 0) return c.json({ error: "nothing to summarize" }, 422);

    try {
      const summary = await runClaudeSummary(
        summaryPrompt(path.basename(projectPath), buildSummaryInput(thread)),
      );
      if (!summary) return c.json({ error: "empty summary from claude -p" }, 502);
      cacheSummary({ sessionId: id, summary, transcriptSize: tail.size, createdAt: Date.now() });
      return c.json({ summary, cached: false });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return c.json({ error: "claude CLI not found on this machine" }, 503);
      return c.json({ error: `claude -p failed: ${(err as Error).message}` }, 502);
    }
  });

  app.post("/api/open-terminal", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { path?: string; id?: string };
    const { path: projectPath, id } = body;
    if (!projectPath || !id) return c.json({ error: "path and id are required" }, 400);
    if (!SESSION_ID_RE.test(id)) return c.json({ error: "invalid session id" }, 400);
    if (!canOpenTerminal()) return c.json({ error: "open-in-terminal is macOS only" }, 501);
    if (!fs.existsSync(projectPath)) return c.json({ error: "project folder not found" }, 404);
    try {
      await openInTerminal(projectPath, id);
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: `osascript failed: ${(err as Error).message}` }, 502);
    }
  });

  return app;
}
