import { useCallback, useEffect, useState } from "react";
import {
  api,
  timeAgo,
  type ProjectInfo,
  type ProjectSession,
  type SessionMeta,
  type ThreadMessage,
} from "../lib/api";
import { projectUrl } from "../lib/router";

const POLL_MS = 5000;

interface Props {
  projectPath: string;
  initialSessionId: string | null;
  navigate: (to: string) => void;
}

export function SessionView({ projectPath, initialSessionId, navigate }: Props) {
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [selected, setSelected] = useState<string | null>(initialSessionId);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const refreshProject = useCallback(async () => {
    try {
      const res = await api.project(projectPath);
      setProject(res.project);
      setSessions(res.sessions);
      setLoaded(true);
      setSelected((cur) => cur ?? res.sessions[0]?.id ?? null);
    } catch {
      setLoaded(true);
    }
  }, [projectPath]);

  const refreshSession = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await api.session(projectPath, selected);
      setMeta(res.meta);
      setThread(res.thread);
    } catch {
      setMeta(null);
      setThread([]);
    }
  }, [projectPath, selected]);

  useEffect(() => {
    void refreshProject();
    const t = setInterval(() => void refreshProject(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshProject]);

  useEffect(() => {
    setCopied(false);
    void refreshSession();
    const t = setInterval(() => void refreshSession(), POLL_MS);
    return () => clearInterval(t);
  }, [refreshSession]);

  const pick = (id: string) => {
    setSelected(id);
    window.history.replaceState(null, "", projectUrl(projectPath, id));
  };

  const copy = async () => {
    if (!meta) return;
    await navigator.clipboard.writeText(meta.resumeCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const projectName = project?.name ?? projectPath.split("/").pop() ?? projectPath;

  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-[280px_1fr] gap-6 px-8 max-md:grid-cols-1">
      <header className="col-span-full flex items-center justify-between border-b border-line py-[22px]">
        <button onClick={() => navigate("/")} className="cursor-pointer font-mono text-[15px] font-bold">
          <span className="text-faint font-normal">~/</span>
          <span className="grad">claude-deck</span>
        </button>
        <span className="font-mono text-xs text-faint" data-testid="crumb">
          <button onClick={() => navigate("/")} className="cursor-pointer hover:text-muted">
            deck
          </button>{" "}
          / <b className="font-medium text-cyan">{projectName}</b>
          {meta ? ` / session ${meta.title}` : ""}
        </span>
      </header>

      <aside className="py-5 max-md:py-0">
        <p className="sect mb-3">Sessions · {projectName}</p>
        <div className="flex flex-col gap-[6px]" data-testid="session-list">
          {loaded && sessions.length === 0 && (
            <p className="font-mono text-xs text-faint" data-testid="no-sessions">
              no claude sessions here yet
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              data-testid="session-item"
              onClick={() => pick(s.id)}
              className={`cursor-pointer rounded-[10px] border px-3 py-[10px] text-left ${
                s.id === selected ? "border-line bg-glass" : "border-transparent hover:bg-white/[0.02]"
              }`}
            >
              <b className="flex items-center gap-[7px] font-mono text-[12.5px] font-medium">
                {s.live && (
                  <i
                    className={`h-[7px] w-[7px] flex-none rounded-full ${
                      s.live.status === "busy" ? "bg-busy shadow-[0_0_8px_var(--color-busy)] pulse" : "bg-faint"
                    }`}
                  />
                )}
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{s.title}</span>
              </b>
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-faint">
                {s.firstPrompt || `${s.promptCount} prompts · ${timeAgo(s.lastTs)}`}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="py-5 pb-10">
        {meta ? (
          <>
            <div
              data-testid="session-head"
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-glass px-5 py-4 backdrop-blur-[8px]"
            >
              {meta.status && (
                <span
                  className={`flex items-center gap-2 font-mono text-xs ${meta.status === "busy" ? "text-busy" : "text-faint"}`}
                >
                  <i
                    className={`h-2 w-2 rounded-full ${
                      meta.status === "busy" ? "bg-busy shadow-[0_0_10px_var(--color-busy)] pulse" : "bg-faint"
                    }`}
                  />
                  {meta.status}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-base font-bold">{meta.title}</h2>
                <p className="font-mono text-xs text-faint">
                  {meta.shortId}
                  {meta.startedAt ? ` · started ${timeAgo(meta.startedAt)}` : ""} · {formatSize(meta.size)} ·{" "}
                  {meta.promptCount} prompts
                </p>
              </div>
              <div className="ml-auto flex items-center gap-[10px] max-md:w-full">
                <span
                  data-testid="resume-cmd"
                  className="overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-line bg-[rgba(10,13,28,.7)] px-[14px] py-[9px] font-mono text-xs text-muted max-md:max-w-[70vw]"
                >
                  <b className="font-medium text-cyan">$</b> claude --resume {meta.shortId}
                </span>
                <button
                  data-testid="copy-btn"
                  onClick={() => void copy()}
                  className="cursor-pointer rounded-[9px] bg-gradient-to-r from-vio to-cyan px-4 py-[9px] font-disp text-[12.5px] font-bold text-bg"
                >
                  {copied ? "copied ✓" : "copy"}
                </button>
              </div>
            </div>

            <div className="mt-[22px] flex max-w-[820px] flex-col gap-[14px]" data-testid="thread">
              {meta.truncated && (
                <p className="text-center font-mono text-[11px] text-faint">
                  ⋯ long session — showing the last {meta.shownCount} messages
                </p>
              )}
              {thread.map((m, i) => (
                <Message key={i} m={m} />
              ))}
              {thread.length === 0 && (
                <p className="font-mono text-xs text-faint">no renderable messages in this transcript</p>
              )}
            </div>
          </>
        ) : (
          loaded && (
            <p className="py-8 font-mono text-xs text-faint" data-testid="no-session">
              {sessions.length === 0
                ? `no transcript found for ${projectName} — start a session with claude first`
                : "pick a session on the left"}
            </p>
          )
        )}
      </main>
    </div>
  );
}

function Message({ m }: { m: ThreadMessage }) {
  const user = m.role === "user";
  return (
    <div
      className={`rounded-[14px] border px-4 py-[13px] text-[13.5px] ${
        user ? "border-vio/30 bg-vio/5" : "border-line bg-glass"
      }`}
      data-testid={`msg-${m.role}`}
    >
      <p className={`mb-[5px] font-mono text-[11px] ${user ? "text-vio" : "text-cyan"}`}>
        {user ? "❯ you" : "✦ claude"}
        {m.ts ? ` — ${formatTime(m.ts)}` : ""}
      </p>
      <p className={`whitespace-pre-wrap break-words ${user ? "text-ink" : "text-muted"}`}>{m.text}</p>
      {m.tools.length > 0 && (
        <div className="mt-[9px] flex flex-wrap gap-[6px]">
          {m.tools.map((t, i) => (
            <span key={i} className="rounded-md border border-line px-[9px] py-[2.5px] font-mono text-[10.5px] text-faint">
              <b className="font-medium text-muted">{t}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
