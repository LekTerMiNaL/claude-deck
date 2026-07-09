import { useEffect, useState } from "react";
import { api, type AgentNode, type SessionAgents, type ThreadMessage } from "../lib/api";
import { Message, formatSize } from "./Message";

interface Props {
  projectPath: string;
  sessionId: string;
}

/** Stable-ish colour per agent type — hashed into the brand palette. */
const CHIP_COLORS = [
  "border-vio/40 text-vio",
  "border-cyan/40 text-cyan",
  "border-busy/40 text-busy",
  "border-[#fbbf24]/40 text-[#fbbf24]",
  "border-[#f472b6]/40 text-[#f472b6]",
];
function chipColor(type: string): string {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length]!;
}

export function AgentTree({ projectPath, sessionId }: Props) {
  const [data, setData] = useState<SessionAgents | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setOpenId(null);
    api
      .agents(projectPath, sessionId)
      .then(setData)
      .catch(() => setData({ taskAgents: [], workflows: [] }));
  }, [projectPath, sessionId]);

  if (!data) return null;
  const total = data.taskAgents.length + data.workflows.reduce((n, w) => n + w.agents.length, 0);
  if (total === 0) return null;

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <section className="mt-6 max-w-[820px]" data-testid="agent-tree">
      <p className="sect mb-3">agents ({total})</p>

      <div className="flex flex-col gap-2">
        {data.taskAgents.map((a) => (
          <AgentRow
            key={a.agentId}
            a={a}
            projectPath={projectPath}
            sessionId={sessionId}
            open={openId === a.agentId}
            onToggle={() => toggle(a.agentId)}
          />
        ))}

        {data.workflows.map((w) => (
          <div key={w.wfId} data-testid="workflow-run" className="rounded-[12px] border border-line/70 bg-white/[0.015] p-2">
            <p className="px-1 py-1 font-mono text-[11px] text-faint">
              ▸ workflow <span className="text-muted">{w.wfId}</span> · {w.agents.length} agents
            </p>
            <div className="flex flex-col gap-2 pl-2">
              {w.agents.map((a) => (
                <AgentRow
                  key={a.agentId}
                  a={a}
                  projectPath={projectPath}
                  sessionId={sessionId}
                  open={openId === a.agentId}
                  onToggle={() => toggle(a.agentId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentRow({
  a,
  projectPath,
  sessionId,
  open,
  onToggle,
}: {
  a: AgentNode;
  projectPath: string;
  sessionId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || thread) return;
    setLoading(true);
    api
      .subagent(projectPath, sessionId, a.agentId)
      .then((res) => setThread(res.thread))
      .catch(() => setThread([]))
      .finally(() => setLoading(false));
  }, [open, thread, projectPath, sessionId, a.agentId]);

  const label = a.description || a.firstPrompt || a.agentId;

  return (
    <div data-testid="agent-row" className="rounded-[12px] border border-line bg-glass">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid="agent-toggle"
      >
        <span
          className={`flex-none rounded-md border px-2 py-[2px] font-mono text-[10.5px] ${chipColor(a.agentType)}`}
        >
          {a.agentType}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-ink">{label}</span>
          <span className="block font-mono text-[11px] text-faint">
            {a.messageCount} messages · {a.toolCount} tools · {formatSize(a.size)}
          </span>
        </span>
        <span className="flex-none font-mono text-[11px] text-cyan">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3" data-testid="agent-thread">
          {loading && <p className="font-mono text-xs text-faint">loading transcript…</p>}
          {thread && thread.length === 0 && !loading && (
            <p className="font-mono text-xs text-faint">no renderable messages</p>
          )}
          {thread && thread.length > 0 && (
            <div className="flex flex-col gap-[10px]">
              {thread.map((m, i) => (
                <Message key={i} m={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
