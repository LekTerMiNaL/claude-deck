import type { ThreadMessage } from "../lib/api";

export function Message({ m }: { m: ThreadMessage }) {
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

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
