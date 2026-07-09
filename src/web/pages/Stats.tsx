import { useEffect, useState } from "react";
import { api, type StatsPayload } from "../lib/api";
import { ChartCard, ColumnChart, StatTile, type ColumnDatum, type Series } from "../components/charts";

const S1: Series = { key: "s1", label: "prompts", color: "var(--color-series-1)" };

export function Stats({ navigate }: { navigate: (to: string) => void }) {
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setFailed(true));
  }, []);

  return (
    <>
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="relative mx-auto max-w-[1180px] px-8 pb-10">
        <header className="flex items-center justify-between border-b border-line py-[22px]">
          <button onClick={() => navigate("/")} className="cursor-pointer font-mono text-[15px] font-bold">
            <span className="font-normal text-faint">~/</span>
            <span className="grad">claude-deck</span>
          </button>
          <span className="font-mono text-xs text-faint">
            <button onClick={() => navigate("/")} className="cursor-pointer hover:text-muted">
              deck
            </button>{" "}
            / <b className="font-medium text-cyan">stats</b>
          </span>
        </header>

        <p className="sect mt-[34px] mb-[14px]">Stats — how much claude gets used</p>

        {failed && <p className="font-mono text-xs text-faint">could not load stats</p>}
        {stats && (
          <>
            <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2" data-testid="kpi-row">
              <StatTile label="sessions" value={stats.totals.sessions} />
              <StatTile label="messages" value={stats.totals.messages} />
              <StatTile label="prompts typed" value={stats.totals.prompts} />
              <StatTile label="tool calls" value={stats.totals.toolCalls} />
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <ChartCard title="prompts / day · last 30 days" series={[S1]} data={promptsData(stats)} formatX={shortDate}>
                <ColumnChart data={promptsData(stats)} series={[S1]} xEvery={7} formatX={shortDate} />
              </ChartCard>

              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <ChartCard
                  title="messages / day"
                  series={[{ key: "m", label: "messages", color: "var(--color-series-1)" }]}
                  data={dailyData(stats, "messages")}
                  formatX={shortDate}
                >
                  <ColumnChart
                    data={dailyData(stats, "messages")}
                    series={[{ key: "m", label: "messages", color: "var(--color-series-1)" }]}
                    xEvery={7}
                    formatX={shortDate}
                    height={110}
                  />
                </ChartCard>
                <ChartCard
                  title="tool calls / day"
                  series={[{ key: "t", label: "tool calls", color: "var(--color-series-2)" }]}
                  data={dailyData(stats, "tools")}
                  formatX={shortDate}
                >
                  <ColumnChart
                    data={dailyData(stats, "tools")}
                    series={[{ key: "t", label: "tool calls", color: "var(--color-series-2)" }]}
                    xEvery={7}
                    formatX={shortDate}
                    height={110}
                  />
                </ChartCard>
              </div>

              {stats.tokens.models.length > 0 && (
                <ChartCard title="tokens / day by model" series={tokenSeries(stats)} data={tokenData(stats)} formatX={shortDate}>
                  <ColumnChart data={tokenData(stats)} series={tokenSeries(stats)} xEvery={7} formatX={shortDate} />
                </ChartCard>
              )}

              <ChartCard
                title="activity by hour of day"
                series={[{ key: "h", label: "sessions", color: "var(--color-series-1)" }]}
                data={hourData(stats)}
              >
                <ColumnChart
                  data={hourData(stats)}
                  series={[{ key: "h", label: "sessions", color: "var(--color-series-1)" }]}
                  xEvery={6}
                  height={90}
                />
              </ChartCard>
            </div>
          </>
        )}

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

const SERIES_TOKENS = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)", "var(--color-series-4)"];

function promptsData(stats: StatsPayload): ColumnDatum[] {
  return stats.promptsPerDay.map((d) => ({ x: d.date, values: [d.count] }));
}

function dailyData(stats: StatsPayload, key: "messages" | "tools"): ColumnDatum[] {
  return stats.daily.map((d) => ({ x: d.date, values: [d[key]] }));
}

function tokenSeries(stats: StatsPayload): Series[] {
  return stats.tokens.models.map((m, i) => ({
    key: m,
    label: m.replace(/^claude-/, ""),
    color: SERIES_TOKENS[i] ?? SERIES_TOKENS[3]!,
  }));
}

function tokenData(stats: StatsPayload): ColumnDatum[] {
  return stats.tokens.perDay.map((d) => ({
    x: d.date,
    values: stats.tokens.models.map((m) => d.byModel[m] ?? 0),
  }));
}

function hourData(stats: StatsPayload): ColumnDatum[] {
  return stats.hourCounts.map((count, h) => ({ x: `${String(h).padStart(2, "0")}:00`, values: [count] }));
}

function shortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
