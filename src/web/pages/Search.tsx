import { useEffect, useRef, useState } from "react";
import { api, type TimelineEntry } from "../lib/api";
import { projectUrl } from "../lib/router";

const DEBOUNCE_MS = 250;
const LIMIT = 50;

export function Search({ navigate, initialQuery }: { navigate: (to: string) => void; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    // keep the query in the URL so back/reload restore the search
    window.history.replaceState(null, "", query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    if (!query) {
      setEntries([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      api
        .search(query, LIMIT)
        .then((res) => {
          if (seq.current !== mySeq) return; // stale response — a newer query won
          setEntries(res.entries);
          setTotal(res.total);
          setSearched(true);
        })
        .catch(() => {
          if (seq.current !== mySeq) return;
          setEntries([]);
          setTotal(0);
          setSearched(true);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

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
            <button onClick={() => navigate("/")} className="cursor-pointer hover:text-muted">
              deck
            </button>{" "}
            / <b className="font-medium text-cyan">search</b>
          </span>
        </header>

        <p className="sect mt-[34px] mb-[14px]">Search — every prompt, all projects</p>

        <label className="flex items-center gap-[10px] rounded-[10px] border border-line bg-glass px-[14px] py-[11px] font-mono text-[13px] text-muted">
          <b className="font-medium text-cyan">$</b>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="grep your prompt history…"
            className="w-full bg-transparent outline-none placeholder:text-faint"
            data-testid="search-input"
          />
        </label>

        <div className="mt-4">
          {!q.trim() && (
            <p className="font-mono text-xs text-faint" data-testid="search-hint">
              # type to search — e.g. a bug you remember fixing, a feature name, ราคาทอง…
            </p>
          )}
          {searched && q.trim() && entries.length === 0 && (
            <p className="font-mono text-xs text-faint" data-testid="search-empty">
              no prompts matching "{q.trim()}"
            </p>
          )}
          {entries.length > 0 && (
            <>
              <p className="mb-2 font-mono text-[11.5px] text-faint" data-testid="search-count">
                <b className="font-medium text-cyan">{total}</b> match{total === 1 ? "" : "es"}
                {total > entries.length ? ` · showing newest ${entries.length}` : ""}
              </p>
              <div className="flex flex-col gap-[6px]">
                {entries.map((e, i) => (
                  <div
                    key={`${e.sessionId}-${e.ts}-${i}`}
                    data-testid="search-row"
                    className="flex items-center gap-3 rounded-xl border border-line bg-glass px-4 py-[9px] backdrop-blur-[8px]"
                  >
                    <span className="flex-none text-right font-mono text-[11px] leading-tight text-faint">
                      {formatDate(e.ts)}
                      <br />
                      {formatTime(e.ts)}
                    </span>
                    <button
                      onClick={() => navigate(projectUrl(e.project))}
                      className="flex-none cursor-pointer rounded-md border border-vio/35 px-2 py-[1px] font-mono text-[10.5px] text-vio hover:bg-vio/10"
                      title={e.displayPath}
                    >
                      {e.projectName}
                    </button>
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-muted">
                      <span className="font-mono text-vio">❯ </span>
                      <Highlight text={e.display} query={q.trim()} />
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
            </>
          )}
        </div>

        <footer className="mt-10 border-t border-line pt-[18px] pb-[26px] text-center font-mono text-[11.5px] text-faint">
          claude-deck · local only (127.0.0.1) · reads ~/.claude read-only · © 2026{" "}
          <a href="https://github.com/LekTerMiNaL" target="_blank" rel="noreferrer" className="text-muted hover:text-cyan">
            LekTerMiNaL
          </a>{" "}
          · MIT
        </footer>
      </div>
    </>
  );
}

/** Highlight every case-insensitive occurrence of `query` in `text`. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: { s: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(q, i);
    if (at === -1) {
      parts.push({ s: text.slice(i), hit: false });
      break;
    }
    if (at > i) parts.push({ s: text.slice(i, at), hit: false });
    parts.push({ s: text.slice(at, at + q.length), hit: true });
    i = at + q.length;
  }
  return (
    <>
      {parts.map((p, idx) =>
        p.hit ? (
          <mark key={idx} className="rounded-[3px] bg-vio/25 px-[2px] text-ink" data-testid="search-hit">
            {p.s}
          </mark>
        ) : (
          <span key={idx}>{p.s}</span>
        ),
      )}
    </>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
