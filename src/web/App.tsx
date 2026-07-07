import { useCallback, useEffect, useState } from "react";
import { api, timeAgo, uptime, type DeckCard, type LiveCard } from "./lib/api";
import { AddModal } from "./components/AddModal";

const POLL_MS = 5000;

export function App() {
  const [live, setLive] = useState<LiveCard[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [l, d] = await Promise.all([api.live(), api.deck()]);
      setLive(l.sessions);
      setDeck(d.projects);
      setLoaded(true);
    } catch {
      // server briefly unavailable — keep last known state, next poll retries
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const busyCount = live.filter((s) => s.status === "busy").length;

  return (
    <>
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="relative mx-auto max-w-[1180px] px-8">
        <header className="relative flex items-center justify-between border-b border-line py-[22px]">
          <span className="font-mono text-[15px] font-bold">
            <span className="text-faint font-normal">~/</span>
            <span className="grad">claude-deck</span>
          </span>
          <div className="flex items-center gap-[14px]">
            <span
              data-testid="live-pill"
              className="flex items-center gap-2 rounded-full border border-busy/35 px-[14px] py-[6px] font-mono text-xs text-busy"
            >
              <i className="h-[7px] w-[7px] rounded-full bg-busy shadow-[0_0_10px_var(--color-busy)]" />
              {busyCount} session{busyCount === 1 ? "" : "s"} running
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="cursor-pointer rounded-[10px] bg-gradient-to-r from-vio to-cyan px-4 py-[9px] font-disp text-[13px] font-bold text-bg"
            >
              + Add project
            </button>
          </div>
        </header>

        <p className="sect mt-[34px] mb-[14px]">Live now</p>
        {live.length === 0 ? (
          <p data-testid="live-empty" className="font-mono text-xs text-faint">
            $ no sessions running — start one with <span className="text-cyan">claude</span> in any project
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-[14px] max-md:grid-cols-1">
            {live.map((s) => (
              <LiveNowCard key={s.pid} s={s} />
            ))}
          </div>
        )}

        <p className="sect mt-[34px] mb-[14px]">
          Deck{deck.length > 0 ? ` — ${deck.length} project${deck.length === 1 ? "" : "s"}` : ""}
        </p>
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {deck.map((p) => (
            <ProjectCard key={p.path} p={p} />
          ))}
          {loaded && (
            <button
              data-testid="add-card"
              onClick={() => setModalOpen(true)}
              className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-line text-faint"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line text-[22px] text-cyan">+</span>
              <p className="font-mono text-[12.5px]">
                {deck.length === 0 ? "your deck is empty — add a project" : "add project to deck"}
              </p>
            </button>
          )}
        </div>

        <footer className="mt-10 border-t border-line pt-[18px] pb-[26px] text-center font-mono text-[11.5px] text-faint">
          claude-deck · local only (127.0.0.1) · reads ~/.claude read-only · crafted with claude code
        </footer>
      </div>

      {modalOpen && <AddModal onClose={() => setModalOpen(false)} onChanged={() => void refresh()} />}
    </>
  );
}

function LiveNowCard({ s }: { s: LiveCard }) {
  const busy = s.status === "busy";
  return (
    <div data-testid="live-card" className="relative rounded-[14px] border border-line bg-glass p-4 px-[18px] backdrop-blur-[8px]">
      <span className={`flex items-center gap-2 font-mono text-[11.5px] ${busy ? "text-busy" : "text-faint"}`}>
        <i
          className={`h-2 w-2 rounded-full ${busy ? "bg-busy shadow-[0_0_10px_var(--color-busy)] pulse" : "bg-faint"}`}
        />
        {s.status}
      </span>
      <span
        className="absolute top-[14px] right-[14px] rounded-[7px] border border-cyan/35 px-[10px] py-1 font-mono text-[11px] text-cyan opacity-60"
        title="session view — Phase 2"
      >
        open ↗
      </span>
      <h3 className="mt-2 font-mono text-[14.5px] font-medium">{s.name}</h3>
      <p className="mt-[3px] text-[12.5px] text-muted">
        {s.projectName} · pid {s.pid} · {uptime(s.startedAt)}
      </p>
      <p className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap text-xs italic text-faint">
        {s.lastPrompt ? `❯ ${s.lastPrompt}` : "—"}
      </p>
    </div>
  );
}

function ProjectCard({ p }: { p: DeckCard }) {
  return (
    <div data-testid="deck-card" className="overflow-hidden rounded-[18px] border border-line bg-glass backdrop-blur-[8px]">
      <div className="flex items-center gap-[6px] border-b border-line bg-white/[0.02] px-4 py-[10px]">
        <span className="h-[9px] w-[9px] rounded-full bg-[#ff6666]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#ffcc66]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#55ff66]" />
        <span className="ml-[6px] font-mono text-[11.5px] text-faint">{p.name}</span>
        {p.liveCount > 0 && (
          <span className="ml-auto font-mono text-[10.5px] text-busy">● {p.liveCount} live</span>
        )}
      </div>
      <div className="p-4 px-[18px]">
        <h3 className="font-disp text-lg font-bold">{p.name}</h3>
        <p className="mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-faint">
          {p.displayPath}
          {p.missing && <span className="text-[#fbbf24]"> · ⚠ folder missing</span>}
        </p>
        <div className="mt-3 flex gap-[14px] font-mono text-[11.5px] text-muted">
          <span>
            sessions <b className="font-medium text-ink">{p.sessionCount}</b>
          </span>
          <span>
            last <b className="font-medium text-cyan">{timeAgo(p.lastTs)}</b>
          </span>
          <span>
            prompts <b className="font-medium text-ink">{p.promptCount.toLocaleString()}</b>
          </span>
        </div>
        {p.lastPrompt && (
          <p className="lastp mt-3 line-clamp-2 border-t border-dashed border-line pt-[10px] text-[12.5px] italic text-muted">
            {p.lastPrompt}
          </p>
        )}
      </div>
    </div>
  );
}
