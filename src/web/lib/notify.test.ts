import { describe, it, expect } from "vitest";
import { diffFinished, snapshot, type StatusMap } from "./notify.js";
import type { LiveCard } from "./api.js";

function card(sessionId: string, status: "busy" | "idle", name = sessionId): LiveCard {
  return {
    pid: 1,
    sessionId,
    name,
    status,
    cwd: "/w/p",
    projectName: "p",
    startedAt: 0,
    lastPrompt: "",
    inDeck: true,
  };
}

const prevOf = (entries: [string, "busy" | "idle"][]): StatusMap => new Map(entries);

describe("diffFinished", () => {
  it("returns sessions that went busy → idle", () => {
    const prev = prevOf([["a", "busy"], ["b", "idle"]]);
    const finished = diffFinished(prev, [card("a", "idle"), card("b", "idle")]);
    expect(finished.map((s) => s.sessionId)).toEqual(["a"]);
  });

  it("ignores idle→idle, busy→busy and idle→busy (start)", () => {
    const prev = prevOf([["a", "idle"], ["b", "busy"], ["c", "idle"]]);
    const finished = diffFinished(prev, [card("a", "idle"), card("b", "busy"), card("c", "busy")]);
    expect(finished).toHaveLength(0);
  });

  it("does not fire on first load (empty prev)", () => {
    expect(diffFinished(new Map(), [card("a", "idle"), card("b", "busy")])).toHaveLength(0);
  });

  it("does not fire for a brand-new session unseen last poll", () => {
    const prev = prevOf([["a", "busy"]]);
    // 'z' appears idle for the first time — no prior busy observation
    expect(diffFinished(prev, [card("z", "idle")]).map((s) => s.sessionId)).toEqual([]);
  });

  it("ignores a session that disappeared (can't tell finished from crashed)", () => {
    const prev = prevOf([["a", "busy"]]);
    // 'a' is gone from next entirely → not reported
    expect(diffFinished(prev, [card("b", "idle")])).toHaveLength(0);
  });
});

describe("snapshot", () => {
  it("captures sessionId → status for the next diff", () => {
    const map = snapshot([card("a", "busy"), card("b", "idle")]);
    expect(map.get("a")).toBe("busy");
    expect(map.get("b")).toBe("idle");
    expect(map.size).toBe(2);
  });
});
