import { defineConfig } from "@playwright/test";
import path from "node:path";

const FIXTURE_CLAUDE_DIR = path.resolve("e2e/fixtures/claude-home");
const E2E_PORT = 5758;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node dist/server/index.js",
    url: `http://127.0.0.1:${E2E_PORT}/api/live`,
    reuseExistingServer: false,
    env: {
      CLAUDE_DECK_PORT: String(E2E_PORT),
      CLAUDE_DECK_CLAUDE_DIR: FIXTURE_CLAUDE_DIR,
      // each run gets a fresh config dir via global setup writing this file
      CLAUDE_DECK_CONFIG_DIR: path.resolve("e2e/.tmp-config"),
      CLAUDE_DECK_FAKE_PIDS: "111111,222222",
    },
  },
  globalSetup: "./e2e/global-setup.ts",
});
