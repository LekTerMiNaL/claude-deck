import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.js";
import { serverPort } from "./data/paths.js";

const app = createApp();

// Serve the built frontend (dist/web) next to dist/server in prod.
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../web");
if (fs.existsSync(webDist)) {
  const relRoot = path.relative(process.cwd(), webDist);
  app.use("/*", serveStatic({ root: relRoot }));
  app.get("*", serveStatic({ path: path.join(relRoot, "index.html") }));
}

const port = serverPort();
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`claude-deck → http://127.0.0.1:${port}`);
});
