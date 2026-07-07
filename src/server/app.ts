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

  return app;
}
