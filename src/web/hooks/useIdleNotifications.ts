import { useCallback, useRef, useState } from "react";
import type { LiveCard } from "../lib/api";
import { diffFinished, fireFinished, snapshot, type StatusMap } from "../lib/notify";

const STORE_KEY = "claudeDeck.notify";

export type NotifyState = "off" | "on" | "blocked";

function initialEnabled(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
}

function permissionState(enabled: boolean): NotifyState {
  if (!enabled) return "off";
  if (typeof Notification === "undefined") return "blocked";
  return Notification.permission === "granted" ? "on" : "blocked";
}

/**
 * Owns notification opt-in + the previous-poll status map. Call `onPoll` with
 * each fresh live-session list; it fires a desktop notification for every
 * session that flipped busy → idle since the last call.
 */
export function useIdleNotifications() {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [state, setState] = useState<NotifyState>(() => permissionState(initialEnabled()));
  const prev = useRef<StatusMap>(new Map());

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      setState("off");
      try {
        localStorage.setItem(STORE_KEY, "0");
      } catch {
        // ignore storage failure
      }
      return;
    }
    let granted = typeof Notification !== "undefined" && Notification.permission === "granted";
    if (!granted && typeof Notification !== "undefined") {
      granted = (await Notification.requestPermission()) === "granted";
    }
    setEnabled(true);
    setState(granted ? "on" : "blocked");
    try {
      localStorage.setItem(STORE_KEY, "1");
    } catch {
      // ignore storage failure
    }
  }, [enabled]);

  const onPoll = useCallback(
    (sessions: LiveCard[]) => {
      if (enabled && state === "on") {
        const finished = diffFinished(prev.current, sessions);
        if (finished.length) fireFinished(finished);
      }
      prev.current = snapshot(sessions);
    },
    [enabled, state],
  );

  return { enabled, state, toggle, onPoll };
}
