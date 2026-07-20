import { useCallback, useEffect, useRef, useState } from "react";
import { api, timeAgo, uptime, type DeckCard, type LiveCard, type UsageInfo } from "../lib/api";
import { projectUrl } from "../lib/router";
import { pollMs } from "../lib/config";
import { useIdleNotifications } from "../hooks/useIdleNotifications";
import { applyTheme, nextTheme, savedTheme, THEME_META, type Theme } from "../lib/theme";
import { AddModal } from "../components/AddModal";

export function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const [live, setLive] = useState<LiveCard[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const notify = useIdleNotifications();
  const { onPoll } = notify; // stable useCallback — keep refresh identity steady

  const cycleTheme = () => {
    const t = nextTheme(theme);
    applyTheme(t);
    setTheme(t);
  };

  const refresh = useCallback(async () => {
    try {
      const [l, d, u] = await Promise.all([api.live(), api.deck(), api.usage()]);
      setLive(l.sessions);
      setDeck(d.projects);
      setUsage(u);
      setLoaded(true);
      onPoll(l.sessions);
    } catch {
      // server briefly unavailable — keep last known state, next poll retries
    }
  }, [onPoll]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), pollMs());
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
            <button
              data-testid="theme-toggle"
              onClick={cycleTheme}
              title={`theme: ${THEME_META[theme].label} — click to switch`}
              className="cursor-pointer font-mono text-xs text-faint hover:text-cyan"
            >
              {THEME_META[theme].icon} {THEME_META[theme].label}
            </button>
            {usage?.configured && <UsagePill usage={usage} />}
            <button
              data-testid="notif-toggle"
              onClick={() => void notify.toggle()}
              title={
                notify.state === "blocked"
                  ? "notifications blocked — enable them for this site in your browser settings"
                  : notify.state === "on"
                    ? "notify me when a busy session goes idle — on"
                    : "notify me when a busy session goes idle"
              }
              className={`cursor-pointer font-mono text-xs ${
                notify.state === "on"
                  ? "text-cyan"
                  : notify.state === "blocked"
                    ? "text-warn"
                    : "text-faint hover:text-cyan"
              }`}
            >
              {notify.state === "on" ? "🔔 notify" : notify.state === "blocked" ? "🔕 blocked" : "🔕 notify"}
            </button>
            <button
              data-testid="search-link"
              onClick={() => navigate("/search")}
              className="cursor-pointer font-mono text-xs text-faint hover:text-cyan"
            >
              $ search
            </button>
            <button
              data-testid="timeline-link"
              onClick={() => navigate("/timeline")}
              className="cursor-pointer font-mono text-xs text-faint hover:text-cyan"
            >
              ## timeline
            </button>
            <button
              data-testid="stats-link"
              onClick={() => navigate("/stats")}
              className="cursor-pointer font-mono text-xs text-faint hover:text-cyan"
            >
              ## stats
            </button>
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
              <LiveNowCard key={s.pid} s={s} navigate={navigate} />
            ))}
          </div>
        )}

        <p className="sect mt-[34px] mb-[14px]">
          Deck{deck.length > 0 ? ` — ${deck.length} project${deck.length === 1 ? "" : "s"}` : ""}
        </p>
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {deck.map((p) => (
            <ProjectCard key={p.path} p={p} navigate={navigate} onRemoved={() => void refresh()} />
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
          claude-deck · local only (127.0.0.1) · reads ~/.claude read-only · crafted with claude code ·{" "}
          © 2026{" "}
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

      {modalOpen && <AddModal onClose={() => setModalOpen(false)} onChanged={() => void refresh()} />}
    </>
  );
}

function UsagePill({ usage }: { usage: UsageInfo }) {
  const tone = (p: number) => (p >= 90 ? "text-danger" : p >= 70 ? "text-warn" : "text-cyan");
  const fill = (p: number) => (p >= 90 ? "bg-danger" : p >= 70 ? "bg-warn" : "bg-cyan");
  const title = [
    ...usage.windows.map(
      (w) => `${w.label} ${Math.round(w.usedPercentage)}%${w.resetsAt ? ` · resets ${new Date(w.resetsAt).toLocaleString()}` : ""}`,
    ),
    usage.updatedAt ? `updated ${timeAgo(usage.updatedAt)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span
      data-testid="usage-pill"
      title={title}
      className={`flex items-center gap-[10px] rounded-full border border-line px-[14px] py-[6px] font-mono text-[11px] ${
        usage.stale ? "opacity-55" : ""
      }`}
    >
      {usage.windows.map((w) => (
        <span key={w.key} className={`flex items-center gap-[6px] ${tone(w.usedPercentage)}`} data-testid={`usage-${w.label}`}>
          {w.label}
          <span className="h-[5px] w-9 overflow-hidden rounded-full bg-white/10">
            <span className={`block h-full ${fill(w.usedPercentage)}`} style={{ width: `${w.usedPercentage}%` }} />
          </span>
          {Math.round(w.usedPercentage)}%
        </span>
      ))}
      {usage.stale && <span className="text-faint">· stale</span>}
    </span>
  );
}

function LiveNowCard({ s, navigate }: { s: LiveCard; navigate: (to: string) => void }) {
  const busy = s.status === "busy";
  return (
    <div data-testid="live-card" className="relative rounded-[14px] border border-line bg-glass p-4 px-[18px] backdrop-blur-[8px]">
      <span className={`flex items-center gap-2 font-mono text-[11.5px] ${busy ? "text-busy" : "text-faint"}`}>
        <i
          className={`h-2 w-2 rounded-full ${busy ? "bg-busy shadow-[0_0_10px_var(--color-busy)] pulse" : "bg-faint"}`}
        />
        {s.status}
      </span>
      <button
        onClick={() => navigate(projectUrl(s.cwd, s.sessionId))}
        className="absolute top-[14px] right-[14px] cursor-pointer rounded-[7px] border border-cyan/35 px-[10px] py-1 font-mono text-[11px] text-cyan"
        data-testid="live-open"
      >
        open ↗
      </button>
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

function ProjectCard({
  p,
  navigate,
  onRemoved,
}: {
  p: DeckCard;
  navigate: (to: string) => void;
  onRemoved: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout>>();

  const removeClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // the card itself navigates
    if (!armed) {
      setArmed(true);
      clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    clearTimeout(disarm.current);
    await api.removeProject(p.path).catch(() => {});
    onRemoved();
  };

  return (
    <div
      data-testid="deck-card"
      onClick={() => navigate(projectUrl(p.path))}
      className="cursor-pointer overflow-hidden rounded-[18px] border border-line bg-glass text-left backdrop-blur-[8px] transition-colors hover:border-vio/40"
    >
      <div className="flex items-center gap-[6px] border-b border-line bg-white/[0.02] px-4 py-[10px]">
        <span className="h-[9px] w-[9px] rounded-full bg-[#ff6666]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#ffcc66]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#55ff66]" />
        <span className="ml-[6px] font-mono text-[11.5px] text-faint">{p.name}</span>
        <span className="ml-auto flex items-center gap-[10px]">
          {p.liveCount > 0 && <span className="font-mono text-[10.5px] text-busy">● {p.liveCount} live</span>}
          <button
            data-testid="remove-project"
            onClick={(e) => void removeClick(e)}
            title="remove from deck (files stay untouched)"
            className={`cursor-pointer font-mono text-[10.5px] ${
              armed ? "text-warn" : "text-faint/60 hover:text-muted"
            }`}
          >
            {armed ? "sure?" : "✕"}
          </button>
        </span>
      </div>
      <div className="w-full p-4 px-[18px]">
        <h3 className="font-disp text-lg font-bold">{p.name}</h3>
        <p className="mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-faint">
          {p.displayPath}
          {p.missing && <span className="text-warn"> · ⚠ folder missing</span>}
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
