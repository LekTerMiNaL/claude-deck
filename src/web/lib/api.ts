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

export interface ProjectSession {
  id: string;
  title: string;
  firstPrompt: string;
  lastPrompt: string;
  promptCount: number;
  lastTs: number;
  size: number;
  live: { pid: number; status: "busy" | "idle"; name: string } | null;
}

export interface ProjectInfo {
  path: string;
  displayPath: string;
  name: string;
  missing: boolean;
}

export interface ThreadMessage {
  role: "user" | "assistant";
  text: string;
  tools: string[];
  ts: string | null;
}

export interface SessionMeta {
  id: string;
  shortId: string;
  title: string;
  status: "busy" | "idle" | null;
  startedAt: number | null;
  lastTs: number | null;
  size: number;
  promptCount: number;
  resumeCmd: string;
  truncated: boolean;
  shownCount: number;
  windowCount: number;
}

export const api = {
  live: () => get<{ sessions: LiveCard[] }>("/api/live"),
  deck: () => get<{ projects: DeckCard[] }>("/api/deck"),
  scan: () => get<{ items: ScanItem[] }>("/api/scan"),
  roots: () => get<{ roots: RootInfo[] }>("/api/roots"),
  addProject: (path: string) => send<{ ok: boolean }>("POST", "/api/deck", { path }),
  removeProject: (path: string) => send<{ ok: boolean }>("DELETE", "/api/deck", { path }),
  addRoot: (path: string) => send<{ ok: boolean }>("POST", "/api/roots", { path }),
  project: (path: string) =>
    get<{ project: ProjectInfo; sessions: ProjectSession[] }>(`/api/project?path=${encodeURIComponent(path)}`),
  session: (path: string, id: string) =>
    get<{ meta: SessionMeta; thread: ThreadMessage[] }>(
      `/api/session?path=${encodeURIComponent(path)}&id=${encodeURIComponent(id)}`,
    ),
  capabilities: () => get<{ openTerminal: boolean; summarize: boolean }>("/api/capabilities"),
  timeline: (limit = 100) => get<{ entries: TimelineEntry[] }>(`/api/timeline?limit=${limit}`),
  summarize: (path: string, id: string) =>
    send<{ summary: string; cached: boolean }>("POST", "/api/session/summary", { path, id }),
  openTerminal: (path: string, id: string) =>
    send<{ ok: boolean }>("POST", "/api/open-terminal", { path, id }),
  agents: (path: string, id: string) =>
    get<SessionAgents>(`/api/session/agents?path=${encodeURIComponent(path)}&id=${encodeURIComponent(id)}`),
  subagent: (path: string, id: string, agent: string) =>
    get<{ thread: ThreadMessage[] }>(
      `/api/subagent?path=${encodeURIComponent(path)}&id=${encodeURIComponent(id)}&agent=${encodeURIComponent(agent)}`,
    ),
};

export interface AgentNode {
  agentId: string;
  agentType: string;
  description: string;
  firstPrompt: string;
  messageCount: number;
  toolCount: number;
  size: number;
  finalText: string;
}

export interface WorkflowRun {
  wfId: string;
  agents: AgentNode[];
}

export interface SessionAgents {
  taskAgents: AgentNode[];
  workflows: WorkflowRun[];
}

export interface TimelineEntry {
  ts: number;
  display: string;
  project: string;
  projectName: string;
  displayPath: string;
  sessionId: string;
  inDeck: boolean;
}

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
