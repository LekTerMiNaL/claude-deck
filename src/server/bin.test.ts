import { describe, it, expect } from "vitest";
import { parseArgs, openCommand } from "../../bin/claude-deck.js";

describe("bin parseArgs", () => {
  it("defaults: port 5757, open browser", () => {
    expect(parseArgs([])).toEqual({ port: 5757, open: true, help: false, version: false });
  });

  it("parses --port/-p and --no-open", () => {
    expect(parseArgs(["--port", "6000", "--no-open"])).toMatchObject({ port: 6000, open: false });
    expect(parseArgs(["-p", "8080"])).toMatchObject({ port: 8080 });
  });

  it("rejects invalid ports and unknown flags", () => {
    expect(() => parseArgs(["--port", "abc"])).toThrow(/invalid port/);
    expect(() => parseArgs(["--port", "0"])).toThrow(/invalid port/);
    expect(() => parseArgs(["--port", "99999"])).toThrow(/invalid port/);
    expect(() => parseArgs(["--wat"])).toThrow(/unknown option/);
  });

  it("help and version flags", () => {
    expect(parseArgs(["--help"])).toMatchObject({ help: true });
    expect(parseArgs(["-v"])).toMatchObject({ version: true });
  });
});

describe("bin openCommand", () => {
  it("builds the right opener per platform", () => {
    expect(openCommand("darwin", "http://x")).toEqual(["open", "http://x"]);
    expect(openCommand("win32", "http://x")).toEqual(["cmd", "/c", "start", "", "http://x"]);
    expect(openCommand("linux", "http://x")).toEqual(["xdg-open", "http://x"]);
  });
});
