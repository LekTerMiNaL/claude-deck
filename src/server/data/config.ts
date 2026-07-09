import fs from "node:fs";
import path from "node:path";
import { configDir } from "./paths.js";

export interface DeckConfig {
  /** Absolute paths of projects added to the deck, in add order. */
  projects: string[];
  /** Absolute paths of registered root folders. */
  roots: string[];
}

function configFile(): string {
  return path.join(configDir(), "config.json");
}

export function readConfig(): DeckConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configFile(), "utf8")) as Partial<DeckConfig>;
    return {
      projects: Array.isArray(raw.projects) ? raw.projects.filter((p) => typeof p === "string") : [],
      roots: Array.isArray(raw.roots) ? raw.roots.filter((p) => typeof p === "string") : [],
    };
  } catch {
    return { projects: [], roots: [] };
  }
}

/** Atomic write (tmp + rename) so a crash never truncates the config. */
export function writeConfig(config: DeckConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.config.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n");
  fs.renameSync(tmp, configFile());
}

export function addProject(projectPath: string): DeckConfig {
  const config = readConfig();
  if (!config.projects.includes(projectPath)) {
    config.projects.push(projectPath);
    writeConfig(config);
  }
  return config;
}

export function removeProject(projectPath: string): DeckConfig {
  const config = readConfig();
  config.projects = config.projects.filter((p) => p !== projectPath);
  writeConfig(config);
  return config;
}

export function addRoot(rootPath: string): DeckConfig {
  const config = readConfig();
  if (!config.roots.includes(rootPath)) {
    config.roots.push(rootPath);
    writeConfig(config);
  }
  return config;
}

export function removeRoot(rootPath: string): DeckConfig {
  const config = readConfig();
  config.roots = config.roots.filter((r) => r !== rootPath);
  writeConfig(config);
  return config;
}
