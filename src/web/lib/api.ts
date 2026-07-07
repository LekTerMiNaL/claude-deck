export interface LiveCard {
  pid: number;
  sessionId: string;
  name: string;
  status: "busy" | "idle";
  cwd: string;
  projectName: string;
  startedAt: number;
  lastPrompt: string;
  inDeck: boolean;
}

export interface DeckCard {
  path: string;
  displayPath: string;
  name: string;
  sessionCount: number;
  lastTs: number;
  promptCount: number;
  lastPrompt: string;
  liveCount: number;
  missing: boolean;
}

export interface ScanItem {
  name: string;
  path: string | null;
  displayPath: string | null;
  encodedName: string;
  sessionCount: number;
  lastTs: number;
  lastPrompt: string;
  missing: boolean;
  inDeck: boolean;
  live: boolean;
}

export interface RootInfo {
  path: string;
  displayPath: string;
  children: { name: string; path: string; displayPath: string; hasHistory: boolean; inDeck: boolean }[];
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function send<T>(method: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `${url} → ${res.status}`);
  return data;
}

export const api = {
  live: () => get<{ sessions: LiveCard[] }>("/api/live"),
  deck: () => get<{ projects: DeckCard[] }>("/api/deck"),
  scan: () => get<{ items: ScanItem[] }>("/api/scan"),
  roots: () => get<{ roots: RootInfo[] }>("/api/roots"),
  addProject: (path: string) => send<{ ok: boolean }>("POST", "/api/deck", { path }),
  removeProject: (path: string) => send<{ ok: boolean }>("DELETE", "/api/deck", { path }),
  addRoot: (path: string) => send<{ ok: boolean }>("POST", "/api/roots", { path }),
};

export function timeAgo(ts: number, now = Date.now()): string {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 45) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 21) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

export function uptime(startedAt: number, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
