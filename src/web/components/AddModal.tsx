import { useEffect, useMemo, useState } from "react";
import { api, timeAgo, type RootInfo, type ScanItem } from "../lib/api";

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export function AddModal({ onClose, onChanged }: Props) {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [roots, setRoots] = useState<RootInfo[]>([]);
  const [filter, setFilter] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [scan, rootsRes] = await Promise.all([api.scan(), api.roots()]);
    setItems(scan.items);
    setRoots(rootsRes.roots);
    setLoading(false);
  }

  useEffect(() => {
    void reload().catch(() => setLoading(false));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const addProject = (path: string) => act(() => api.addProject(path));
  const addAsProject = () => pathInput.trim() && act(async () => {
    await api.addProject(pathInput.trim());
    setPathInput("");
  });
  const registerRoot = () => pathInput.trim() && act(async () => {
    await api.addRoot(pathInput.trim());
    setPathInput("");
  });

  const q = filter.trim().toLowerCase();
  const filtered = useMemo(
    () => items.filter((i) => !q || i.name.toLowerCase().includes(q) || (i.path ?? "").toLowerCase().includes(q)),
    [items, q],
  );

  // Root subfolders that aren't already visible in the scanned list.
  const scannedPaths = useMemo(() => new Set(items.map((i) => i.path).filter(Boolean)), [items]);
  const rootRows = useMemo(
    () =>
      roots.flatMap((r) =>
        r.children
          .filter((ch) => !scannedPaths.has(ch.path))
          .filter((ch) => !q || ch.name.toLowerCase().includes(q) || ch.path.toLowerCase().includes(q))
          .map((ch) => ({ ...ch, root: r.displayPath })),
      ),
    [roots, scannedPaths, q],
  );

  return (
    <div>
      <div className="fixed inset-0 bg-[rgba(4,6,14,.72)] backdrop-blur-[4px]" onClick={onClose} />
      <div
        data-testid="add-modal"
        className="fixed top-1/2 left-1/2 max-h-[86vh] w-[640px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[20px] border border-line bg-[#0d1122] shadow-[0_40px_100px_rgba(0,0,0,.6)] flex flex-col"
      >
        <div className="flex items-center gap-[6px] border-b border-line bg-white/[0.02] px-5 py-[14px]">
          <span className="h-[10px] w-[10px] rounded-full bg-[#ff6666]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#ffcc66]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#55ff66]" />
          <span className="ml-2 font-mono text-xs text-faint">add project — scanned from ~/.claude/projects</span>
          <button onClick={onClose} className="ml-auto cursor-pointer text-base text-faint" aria-label="close">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <label className="flex items-center gap-[10px] rounded-[10px] border border-line bg-glass px-[14px] py-[11px] font-mono text-[13px] text-muted">
            <b className="font-medium text-cyan">$</b>
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filter…"
              className="w-full bg-transparent outline-none placeholder:text-muted"
              data-testid="filter-input"
            />
          </label>

          <div className="mt-[14px] flex items-center gap-2 rounded-[10px] border border-line bg-glass px-[14px] py-[9px] font-mono text-[12.5px]">
            <b className="font-medium text-vio">❯</b>
            <input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="paste a project path or a root folder…"
              className="w-full bg-transparent text-muted outline-none placeholder:text-faint"
              data-testid="path-input"
            />
            <button
              onClick={() => void addAsProject()}
              className="cursor-pointer whitespace-nowrap rounded-lg bg-gradient-to-r from-vio to-cyan px-3 py-[5px] font-disp text-[11.5px] font-bold text-bg"
              data-testid="add-path-btn"
            >
              + Add
            </button>
            <button
              onClick={() => void registerRoot()}
              className="cursor-pointer whitespace-nowrap rounded-lg border border-cyan/35 px-3 py-[5px] font-mono text-[11px] text-cyan"
              data-testid="add-root-btn"
              title="register a root folder — its subfolders become addable"
            >
              + root
            </button>
          </div>
          {error && (
            <p data-testid="modal-error" className="mt-2 font-mono text-[11.5px] text-[#fbbf24]">
              ⚠ {error}
            </p>
          )}

          <p className="mx-[2px] mt-[14px] mb-2 font-mono text-[11.5px] text-faint">
            <b className="font-medium text-cyan">{filtered.length}</b> projects found · sorted by last activity ·
            already in deck are marked
          </p>

          <div className="mt-[6px] flex flex-col gap-2">
            {loading && <p className="font-mono text-xs text-faint">scanning…</p>}
            {filtered.map((item) => (
              <ScanRow key={item.encodedName} item={item} onAdd={addProject} />
            ))}
            {roots.length > 0 && (
              <p className="mx-[2px] mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[11.5px] text-faint">
                registered roots:
                {roots.map((r) => (
                  <RootChipRemove key={r.path} root={r} onRemove={() => act(() => api.removeRoot(r.path))} />
                ))}
              </p>
            )}
            {rootRows.length > 0 && (
              <p className="mx-[2px] mt-2 font-mono text-[11.5px] text-faint">
                from registered roots · no claude history yet
              </p>
            )}
            {rootRows.map((ch) => (
              <div key={ch.path} data-testid="root-child-row" className="flex items-center gap-[14px] rounded-xl border border-line bg-glass px-4 py-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-line font-mono text-sm text-vio">
                  {ch.name.slice(0, 2).toLowerCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block font-mono text-[13.5px] font-medium">{ch.name}</b>
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-faint">
                    {ch.displayPath}
                  </span>
                </span>
                <span className="flex-none text-right font-mono text-[11px] text-muted">no history</span>
                {ch.inDeck ? <InDeckBadge /> : <AddButton onClick={() => void addProject(ch.path)} />}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-dashed border-line px-5 py-3 font-mono text-[11px] text-faint">
          # deck config → ~/.claude-deck/config.json · nothing in ~/.claude is ever written
        </div>
      </div>
    </div>
  );
}

function RootChipRemove({ root, onRemove }: { root: RootInfo; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <span data-testid="root-chip" className="inline-flex items-center gap-[6px] rounded-md border border-line px-2 py-[1px]">
      <span className="text-muted">{root.displayPath}</span>
      <button
        data-testid="remove-root"
        onClick={() => (armed ? onRemove() : setArmed(true))}
        title="unregister this root (its already-added projects stay in the deck)"
        className={`cursor-pointer ${armed ? "text-[#fbbf24]" : "text-faint hover:text-muted"}`}
      >
        {armed ? "sure?" : "✕"}
      </button>
    </span>
  );
}

function ScanRow({ item, onAdd }: { item: ScanItem; onAdd: (path: string) => void }) {
  return (
    <div
      data-testid="scan-row"
      className={`flex items-center gap-[14px] rounded-xl border border-line bg-glass px-4 py-3 ${item.missing ? "opacity-55" : ""}`}
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-line font-mono text-sm text-vio">
        {item.name.slice(0, 2).toLowerCase()}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-mono text-[13.5px] font-medium">{item.name}</b>
        {item.missing ? (
          <span className="block font-mono text-[11.5px] text-[#fbbf24]">⚠ folder missing — history only</span>
        ) : (
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11.5px] text-faint">
            {item.displayPath}
          </span>
        )}
      </span>
      <span className="flex-none text-right font-mono text-[11px] text-muted">
        {item.live && (
          <>
            <span className="text-busy">● live now</span>
            <br />
          </>
        )}
        {item.sessionCount} session{item.sessionCount === 1 ? "" : "s"} · {timeAgo(item.lastTs)}
      </span>
      {item.inDeck ? (
        <InDeckBadge />
      ) : item.path ? (
        <AddButton onClick={() => onAdd(item.path!)} />
      ) : (
        <span className="flex-none font-mono text-[11px] text-faint" title="real path unknown — encoded name only">
          unresolved
        </span>
      )}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-none cursor-pointer rounded-lg bg-gradient-to-r from-vio to-cyan px-[14px] py-[7px] font-disp text-xs font-bold text-bg"
    >
      + Add
    </button>
  );
}

function InDeckBadge() {
  return (
    <span className="flex-none rounded-lg border border-busy/40 px-3 py-[7px] font-mono text-[11.5px] font-medium text-busy">
      ✓ in deck
    </span>
  );
}
