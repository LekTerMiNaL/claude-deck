import fs from "node:fs";
import { execFile } from "node:child_process";

/** Shell-quote for the command embedded in the AppleScript `do script`. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function resumeCommand(projectPath: string, sessionId: string): string {
  return `cd ${shellQuote(projectPath)} && claude --resume ${sessionId}`;
}

/** AppleScript string literal — escape backslashes and double quotes. */
function appleScriptString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function openTerminalScript(projectPath: string, sessionId: string): string[] {
  const cmd = resumeCommand(projectPath, sessionId);
  return ["-e", `tell application "Terminal" to do script ${appleScriptString(cmd)}`, "-e", 'tell application "Terminal" to activate'];
}

export function canOpenTerminal(): boolean {
  if (process.env.CLAUDE_DECK_FAKE_OPEN) return true;
  return process.platform === "darwin" && fs.existsSync("/usr/bin/osascript");
}

/** Launch Terminal with the resume command (or record it, in fake test mode). */
export function openInTerminal(projectPath: string, sessionId: string): Promise<void> {
  const fakeFile = process.env.CLAUDE_DECK_FAKE_OPEN;
  if (fakeFile) {
    fs.appendFileSync(fakeFile, resumeCommand(projectPath, sessionId) + "\n");
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/osascript", openTerminalScript(projectPath, sessionId), (err) =>
      err ? reject(err) : resolve(),
    );
  });
}
