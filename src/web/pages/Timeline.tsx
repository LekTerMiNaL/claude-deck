import { useEffect, useMemo, useState } from "react";
import { api, type TimelineEntry } from "../lib/api";
import { projectUrl } from "../lib/router";

export function Timeline({ navigate }: { navigate: (to: string) => void }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .timeline(150)
      .then((res) => {
        setEntries(res.entries);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <>
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="relative mx-auto max-w-[900px] px-8">
        <header className="flex items-center justify-between border-b border-line py-[22px]">
          <button onClick={() => navigate("/")} className="cursor-pointer font-mono text-[15px] font-bold">
            <span className="text-faint font-normal">~/</span>
            <span className="grad">claude-deck</span>
          </button>
          <span className="font-mono text-xs text-faint">
            <button onClick={() => navigate("/search")} className="cursor-pointer hover:text-cyan">
              $ search
            </button>{" "}
            ·{" "}
            <button onClick={() => navigate("/")} className="cursor-pointer hover:text-muted">
              deck
            </button>{" "}
            / <b className="font-medium text-cyan">timeline</b>
          </span>
        </header>

        <p className="sect mt-[34px] mb-[14px]">Timeline — all projects</p>
        {loaded && entries.length === 0 && (
          <p className="font-mono text-xs text-faint" data-testid="timeline-empty">
            no prompt history yet
          </p>
        )}

        {groups.map((g) => (
          <div key={g.label} className="mb-7" data-testid="timeline-day">
            <p className="mb-[10px] font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              <span className="text-vio">##</span> {g.label}
            </p>
            <div className="flex flex-col gap-[6px]">
              {g.entries.map((e, i) => (
                <div
                  key={`${e.sessionId}-${e.ts}-${i}`}
                  data-testid="timeline-row"
                  className="flex items-center gap-3 rounded-xl border border-line bg-glass px-4 py-[9px] backdrop-blur-[8px]"
                >
                  <span className="flex-none font-mono text-[11px] text-faint">{formatTime(e.ts)}</span>
                  <button
                    onClick={() => navigate(projectUrl(e.project))}
                    className="flex-none cursor-pointer rounded-md border border-vio/35 px-2 py-[1px] font-mono text-[10.5px] text-vio hover:bg-vio/10"
                    title={e.displayPath}
                  >
                    {e.projectName}
                  </button>
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-muted">
                    <span className="font-mono text-vio">❯ </span>
                    {e.display}
                  </span>
                  <button
                    onClick={() => navigate(projectUrl(e.project, e.sessionId))}
                    className="flex-none cursor-pointer font-mono text-[10.5px] text-cyan opacity-70 hover:opacity-100"
                  >
                    open ↗
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <footer className="mt-10 border-t border-line pt-[18px] pb-[26px] text-center font-mono text-[11.5px] text-faint">
          claude-deck · local only (127.0.0.1) · reads ~/.claude read-only · © 2026{" "}
          <a
            href="https://github.com/LekTerMiNaL"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-cyan"
          >
            LekTerMiNaL
          </a>{" "}
          · MIT
        </footer>
      </div>
    </>
  );
}

function groupByDay(entries: TimelineEntry[]): { label: string; entries: TimelineEntry[] }[] {
  const groups: { label: string; entries: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.ts);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(e);
    else groups.push({ label, entries: [e] });
  }
  return groups;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400_000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "today";
  if (sameDay(d, yesterday)) return "yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
