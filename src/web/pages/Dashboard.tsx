import { useCallback, useEffect, useRef, useState } from "react";
import { api, timeAgo, uptime, type DeckCard, type LiveCard, type UsageInfo } from "../lib/api";
import { projectUrl } from "../lib/router";
import { pollMs } from "../lib/config";
import { useIdleNotifications } from "../hooks/useIdleNotifications";
import { savedTheme, THEME_META, type Theme } from "../lib/theme";
import { AddModal } from "../components/AddModal";
import { ThemeModal } from "../components/ThemeModal";

export function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const [live, setLive] = useState<LiveCard[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const notify = useIdleNotifications();
  const { onPoll } = notify; // stable useCallback — keep refresh identity steady

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
              onClick={() => setThemeOpen(true)}
              title="choose theme"
              className="cursor-pointer font-mono text-xs text-faint hover:text-cyan"
            >
              {THEME_META[theme].icon} {THEME_META[theme].label}
            </button>
            {usage?.configured && (
              <UsagePill usage={usage} open={usageOpen} onToggle={() => setUsageOpen((o) => !o)} />
            )}
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

        {usage?.configured && usageOpen && <UsagePanel usage={usage} onClose={() => setUsageOpen(false)} />}

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
      {themeOpen && <ThemeModal current={theme} onPick={setTheme} onClose={() => setThemeOpen(false)} />}
    </>
  );
}

const usageTone = (p: number) => (p >= 90 ? "text-danger" : p >= 70 ? "text-warn" : "text-cyan");
const usageFill = (p: number) => (p >= 90 ? "bg-danger" : p >= 70 ? "bg-warn" : "bg-cyan");

function UsagePill({ usage, open, onToggle }: { usage: UsageInfo; open: boolean; onToggle: () => void }) {
  return (
    <button
      data-testid="usage-pill"
      onClick={onToggle}
      title="usage limits — click for details"
      className={`flex cursor-pointer items-center gap-[10px] rounded-full border px-[14px] py-[6px] font-mono text-[11px] hover:border-cyan/40 ${
        open ? "border-cyan/50" : "border-line"
      } ${usage.stale ? "opacity-55" : ""}`}
    >
      {usage.windows.map((w) => (
        <span key={w.key} className={`flex items-center gap-[6px] ${usageTone(w.usedPercentage)}`} data-testid={`usage-${w.label}`}>
          {w.label}
          <span className="h-[5px] w-9 overflow-hidden rounded-full bg-white/10">
            <span className={`block h-full ${usageFill(w.usedPercentage)}`} style={{ width: `${w.usedPercentage}%` }} />
          </span>
          {Math.round(w.usedPercentage)}%
        </span>
      ))}
      {usage.stale && <span className="text-faint">· stale</span>}
      <span className="text-faint">{open ? "▴" : "▾"}</span>
    </button>
  );
}

const WINDOW_NAME: Record<string, string> = { "5h": "5-hour session", week: "weekly" };

function UsagePanel({ usage, onClose }: { usage: UsageInfo; onClose: () => void }) {
  return (
    <div
      data-testid="usage-panel"
      className="mt-4 rounded-[16px] border border-line bg-glass px-5 py-4 backdrop-blur-[8px]"
    >
      <div className="mb-3 flex items-center">
        <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">usage limits</p>
        <button
          onClick={onClose}
          data-testid="usage-panel-close"
          className="ml-auto cursor-pointer font-mono text-[11px] text-faint hover:text-cyan"
          aria-label="collapse"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        {usage.windows.map((w) => (
          <div key={w.key} data-testid={`usage-detail-${w.label}`}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[12px] text-muted">{WINDOW_NAME[w.label] ?? w.label}</span>
              <span className={`font-disp text-[22px] font-bold ${usageTone(w.usedPercentage)}`}>
                {Math.round(w.usedPercentage)}%
              </span>
            </div>
            <span className="mt-2 block h-[9px] overflow-hidden rounded-full bg-white/10">
              <span className={`block h-full ${usageFill(w.usedPercentage)}`} style={{ width: `${w.usedPercentage}%` }} />
            </span>
            <span className="mt-[6px] block font-mono text-[11px] text-faint">
              {w.resetsAt ? `resets ${new Date(w.resetsAt).toLocaleString()}` : "reset time unknown"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] text-faint">
        {usage.model ? `${usage.model} · ` : ""}
        {usage.updatedAt ? `updated ${timeAgo(usage.updatedAt)}` : ""}
        {usage.stale ? " · stale (no session running)" : ""} · fed by the statusline bridge
      </p>
    </div>
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
