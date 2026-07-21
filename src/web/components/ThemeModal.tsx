import { useEffect } from "react";
import { THEMES, THEME_META, applyTheme, type Theme } from "../lib/theme";

interface Props {
  current: Theme;
  onPick: (t: Theme) => void;
  onClose: () => void;
}

/** Pick-a-theme modal with live CSS mini-previews — applying is instant, so the
    page behind the backdrop doubles as the full preview. */
export function ThemeModal({ current, onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (t: Theme) => {
    applyTheme(t);
    onPick(t);
  };

  return (
    <div>
      <div className="fixed inset-0 bg-[rgba(4,6,14,.6)] backdrop-blur-[3px]" onClick={onClose} />
      <div
        data-testid="theme-modal"
        className="fixed top-1/2 left-1/2 w-[680px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-line bg-panel shadow-[0_40px_100px_rgba(0,0,0,.6)]"
      >
        <div className="flex items-center gap-[6px] border-b border-line bg-white/[0.02] px-5 py-[14px]">
          <span className="h-[10px] w-[10px] rounded-full bg-[#ff6666]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#ffcc66]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#55ff66]" />
          <span className="ml-2 font-mono text-xs text-faint">choose theme — applies instantly, saved to this browser</span>
          <button onClick={onClose} className="ml-auto cursor-pointer text-base text-faint" aria-label="close">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-5 max-md:grid-cols-1">
          {THEMES.map((t) => {
            const meta = THEME_META[t];
            const p = meta.preview;
            const active = t === current;
            return (
              <button
                key={t}
                data-testid={`theme-option-${t}`}
                onClick={() => pick(t)}
                className={`cursor-pointer overflow-hidden rounded-[14px] border text-left transition-transform hover:-translate-y-[2px] ${
                  active ? "border-cyan shadow-[0_0_0_1px_var(--color-cyan)]" : "border-line"
                }`}
              >
                {/* mini preview painted with the theme's real colors */}
                <div className="p-3" style={{ background: p.bg }}>
                  <div
                    className="rounded-[9px] p-2"
                    style={{ background: p.card, border: `1.5px solid ${p.cardBorder}`, boxShadow: p.cardShadow }}
                  >
                    <div className="mb-[6px] flex items-center gap-[3px]">
                      <i className="h-[5px] w-[5px] rounded-full bg-[#ff6666]" />
                      <i className="h-[5px] w-[5px] rounded-full bg-[#ffcc66]" />
                      <i className="h-[5px] w-[5px] rounded-full bg-[#55ff66]" />
                    </div>
                    <p style={{ color: p.ink, fontFamily: p.font, fontSize: t === "arcade" ? 7 : 10, fontWeight: 700 }}>
                      rocket-shop
                    </p>
                    <p className="mt-[3px]" style={{ color: p.muted, fontSize: 8 }}>
                      sessions 12 · last 2m ago
                    </p>
                    <div className="mt-[6px] flex gap-[4px]">
                      <span className="h-[8px] w-8 rounded-full" style={{ background: p.accent1 }} />
                      <span className="h-[8px] w-5 rounded-full" style={{ background: p.accent2 }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-line px-3 py-[9px]">
                  <span className="text-[14px]">{meta.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] font-medium text-ink">{meta.label}</span>
                    <span className="block truncate text-[10.5px] text-faint">{meta.tagline}</span>
                  </span>
                  {active && (
                    <span data-testid="theme-active" className="ml-auto font-mono text-[10.5px] text-busy">
                      ✓ active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-dashed border-line px-5 py-3 font-mono text-[11px] text-faint">
          # saved as claudeDeck.theme in localStorage · midnight is the default
        </div>
      </div>
    </div>
  );
}
