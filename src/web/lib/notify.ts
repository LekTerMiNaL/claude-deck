import type { LiveCard } from "./api";

export type StatusMap = Map<string, "busy" | "idle">;

/**
 * Sessions that went busy → idle between two polls — i.e. "just finished".
 * Pure and DOM-free so it can be unit-tested. A session only counts if it was
 * seen busy in `prev` and is idle-and-still-present in `next`; first-load
 * (empty prev) and freshly-appeared sessions never count.
 */
export function diffFinished(prev: StatusMap, next: LiveCard[]): LiveCard[] {
  return next.filter((s) => prev.get(s.sessionId) === "busy" && s.status === "idle");
}

/** Snapshot the current statuses for the next diff. */
export function snapshot(sessions: LiveCard[]): StatusMap {
  return new Map(sessions.map((s) => [s.sessionId, s.status]));
}

/** Fire a desktop notification per finished session (thin DOM wrapper). */
export function fireFinished(sessions: LiveCard[]): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  for (const s of sessions) {
    new Notification(`✓ ${s.name} finished`, {
      body: `${s.projectName} is now idle`,
      tag: s.sessionId,
    });
  }
}
