import { useEffect, useRef, useState } from "react";
import { api, type DeepMatch, type TimelineEntry } from "../lib/api";
import { projectUrl } from "../lib/router";

const DEBOUNCE_MS = 250;
const LIMIT = 50;

export type SearchMode = "prompts" | "deep";

export function Search({
  navigate,
  initialQuery,
  initialMode,
}: {
  navigate: (to: string) => void;
  initialQuery: string;
  initialMode: SearchMode;
}) {
  const [q, setQ] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [matches, setMatches] = useState<DeepMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    // keep query + mode in the URL so back/reload restore the search
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (mode === "deep") params.set("mode", "deep");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/search?${qs}` : "/search");
    if (!query) {
      setEntries([]);
      setMatches([]);
      setTotal(0);
      setSearched(false);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      if (mode === "deep") setIndexing(true); // first run may build the index
      const done = () => {
        if (seq.current === mySeq) {
          setSearched(true);
          setIndexing(false);
        }
      };
      if (mode === "prompts") {
        api
          .search(query, LIMIT)
          .then((res) => {
            if (seq.current !== mySeq) return;
            setEntries(res.entries);
            setMatches([]);
            setTotal(res.total);
          })
          .catch(() => {
            if (seq.current !== mySeq) return;
            setEntries([]);
            setTotal(0);
          })
          .finally(done);
      } else {
        api
          .deepSearch(query, LIMIT)
          .then((res) => {
            if (seq.current !== mySeq) return;
            setMatches(res.matches);
            setEntries([]);
            setTotal(res.total);
          })
          .catch(() => {
            if (seq.current !== mySeq) return;
            setMatches([]);
            setTotal(0);
          })
          .finally(done);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, mode]);

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
            placeholder={mode === "prompts" ? "grep your prompt history…" : "grep every transcript — what claude said too…"}
            className="w-full bg-transparent outline-none placeholder:text-faint"
            data-testid="search-input"
          />
        </label>

        <div className="mt-3 flex items-center gap-2 font-mono text-[11px]">
          <button
            data-testid="mode-prompts"
            onClick={() => setMode("prompts")}
            className={`cursor-pointer rounded-md border px-[10px] py-[3px] ${
              mode === "prompts" ? "border-vio/40 text-vio" : "border-line text-faint hover:text-muted"
            }`}
          >
            ❯ prompts
          </button>
          <button
            data-testid="mode-deep"
            onClick={() => setMode("deep")}
            className={`cursor-pointer rounded-md border px-[10px] py-[3px] ${
              mode === "deep" ? "border-cyan/40 text-cyan" : "border-line text-faint hover:text-muted"
            }`}
          >
            ✦ full text
          </button>
          <span className="text-faint">
            {mode === "prompts" ? "· what you typed" : "· everything in every transcript"}
          </span>
        </div>

        <div className="mt-4">
          {!q.trim() && (
            <p className="font-mono text-xs text-faint" data-testid="search-hint">
              # type to search — e.g. a bug you remember fixing, a feature name, ราคาทอง…
            </p>
          )}
          {indexing && !searched && (
            <p className="font-mono text-xs text-faint" data-testid="search-indexing">
              ⠸ indexing transcripts…
            </p>
          )}
          {searched && q.trim() && entries.length === 0 && matches.length === 0 && (
            <p className="font-mono text-xs text-faint" data-testid="search-empty">
              no {mode === "prompts" ? "prompts" : "transcript text"} matching "{q.trim()}"
            </p>
          )}
          {matches.length > 0 && (
            <>
              <p className="mb-2 font-mono text-[11.5px] text-faint" data-testid="search-count">
                <b className="font-medium text-cyan">{total}</b> match{total === 1 ? "" : "es"}
                {total > matches.length ? ` · showing newest ${matches.length}` : ""}
              </p>
              <div className="flex flex-col gap-[6px]">
                {matches.map((m, i) => (
                  <div
                    key={`${m.sessionId}-${i}`}
                    data-testid="deep-row"
                    className="flex items-start gap-3 rounded-xl border border-line bg-glass px-4 py-[9px] backdrop-blur-[8px]"
                  >
                    <span
                      className={`flex-none font-mono text-[12px] ${m.role === "user" ? "text-vio" : "text-cyan"}`}
                      title={m.role === "user" ? "you said" : "claude said"}
                      data-testid="deep-role"
                    >
                      {m.role === "user" ? "❯" : "✦"}
                    </span>
                    {m.project && (
                      <button
                        onClick={() => navigate(projectUrl(m.project!))}
                        className="flex-none cursor-pointer rounded-md border border-vio/35 px-2 py-[1px] font-mono text-[10.5px] text-vio hover:bg-vio/10"
                        title={m.displayPath ?? undefined}
                      >
                        {m.projectName}
                      </button>
                    )}
                    <span className="min-w-0 flex-1 text-[12.5px] text-muted">
                      <Highlight text={m.snippet} query={q.trim()} />
                    </span>
                    {m.project && (
                      <button
                        onClick={() => navigate(projectUrl(m.project!, m.sessionId))}
                        className="flex-none cursor-pointer font-mono text-[10.5px] text-cyan opacity-70 hover:opacity-100"
                      >
                        open ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
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
