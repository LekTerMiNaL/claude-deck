import fs from "node:fs";
import { Hono } from "hono";
import { liveCards, deckCards } from "./data/deck.js";
import { scanProjects, rootChildren } from "./data/scan.js";
import { readConfig, addProject, removeProject, addRoot } from "./data/config.js";
import { readHistoryIndex } from "./data/history.js";
import { expandHome, shortenHome } from "./data/paths.js";

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

  return app;
}
