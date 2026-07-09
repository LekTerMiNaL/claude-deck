import { useMemo, useState, type ReactNode } from "react";

/* SVG column charts per the dataviz mark specs: columns ≤24px with a 4px
   rounded data-end (square baseline), 2px surface gaps between adjacent
   columns and stacked segments, solid hairline gridlines, muted-ink labels
   (text never wears the series color), per-column hover/focus tooltip and a
   table-view twin so tooltips enhance but never gate. */

export interface Series {
  key: string;
  label: string;
  /** CSS color — one of the validated --color-series-* tokens. */
  color: string;
}

export interface ColumnDatum {
  x: string;
  /** One value per series, aligned with `series`. */
  values: number[];
}

export function compactNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Clean y-axis max: 1/2/5 × 10^k covering the data max. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= max) return m * pow;
  }
  return 10 * pow;
}

const W = 640;
const PLOT_H = 150;
const AXIS_H = 18;
const PAD_T = 10; // keeps the top tick label from clipping the viewBox
const PAD_L = 44;
const PAD_R = 8;
const GAP = 2; // the surface gap, in px of viewBox space
const MAX_BAR = 24;
const RADIUS = 4;

/** Rounded top, square baseline. Degrades to a plain rect for tiny heights. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  if (h <= 0.5) return "";
  if (r < 1) return `M${x},${y + h} L${x},${y} L${x + w},${y} L${x + w},${y + h} Z`;
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  series: Series[];
  /** Show an x label every `xEvery` columns (sparse, muted). */
  xEvery?: number;
  formatX?: (x: string) => string;
  height?: number;
}

export function ColumnChart({ data, series, xEvery = 7, formatX = (x) => x, height = PLOT_H }: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const yMax = niceMax(Math.max(...totals, 0));
  const innerW = W - PAD_L - PAD_R;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(MAX_BAR, Math.max(2, band - GAP));
  // dedupe tick labels (a small yMax makes 0.5·yMax round onto yMax)
  const ticks = [...new Map([0, 0.5, 1].map((f) => [compactNumber(yMax * f), yMax * f])).values()];
  const totalH = PAD_T + height + AXIS_H;

  const yOf = (v: number) => PAD_T + height - (v / yMax) * height;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${totalH}`} className="block w-full" role="img">
        {/* recessive solid hairline grid + clean ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={PAD_L - 6} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill="var(--color-faint)" fontFamily="var(--font-mono)">
              {compactNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD_L + i * band + (band - barW) / 2;
          let yCursor = PAD_T + height;
          const segs = d.values.map((v, si) => {
            const h = (v / yMax) * height;
            const seg = { v, si, y: yCursor - h, h };
            yCursor -= h + (h > 0 ? GAP : 0); // 2px surface gap between segments
            return seg;
          });
          const visible = segs.filter((s) => s.h > 0.5);
          const topIdx = visible.length ? visible[visible.length - 1]!.si : -1;
          return (
            <g key={d.x} opacity={active === null || active === i ? 1 : 0.45}>
              {segs.map((s) =>
                s.h > 0.5 ? (
                  s.si === topIdx ? (
                    <path key={s.si} d={columnPath(x, s.y, barW, s.h)} fill={series[s.si]!.color} />
                  ) : (
                    <rect key={s.si} x={x} y={s.y} width={barW} height={s.h} fill={series[s.si]!.color} />
                  )
                ) : null,
              )}
              {i % xEvery === 0 && (
                <text x={PAD_L + i * band + band / 2} y={PAD_T + height + 13} textAnchor="middle" fontSize={9} fill="var(--color-faint)" fontFamily="var(--font-mono)">
                  {formatX(d.x)}
                </text>
              )}
              {/* full-height hit target (≥ band wide) for hover + keyboard focus */}
              <rect
                x={PAD_L + i * band}
                y={0}
                width={band}
                height={PAD_T + height}
                fill="transparent"
                tabIndex={0}
                aria-label={`${formatX(d.x)}: ${series.map((s, si) => `${s.label} ${compactNumber(d.values[si] ?? 0)}`).join(", ")}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                data-testid="chart-hit"
              />
            </g>
          );
        })}
      </svg>

      {active !== null && data[active] && (
        <div
          data-testid="chart-tooltip"
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-line bg-[#0d1122] px-3 py-2 font-mono text-[10.5px] whitespace-nowrap shadow-[0_8px_30px_rgba(0,0,0,.5)]"
          style={{ left: `${((PAD_L + active * (innerW / Math.max(1, data.length)) + innerW / Math.max(1, data.length) / 2) / W) * 100}%` }}
        >
          <p className="text-muted">{formatX(data[active]!.x)}</p>
          {series.map((s, si) => (
            <p key={s.key} className="flex items-center gap-[6px] text-ink">
              <i className="h-2 w-2 flex-none rounded-[3px]" style={{ background: s.color }} />
              <span className="text-faint">{s.label}</span> {compactNumber(data[active]!.values[si] ?? 0)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  series: Series[];
  data: ColumnDatum[];
  formatX?: (x: string) => string;
  children: ReactNode; // the chart
}

/** Card with title, legend (≥2 series only) and the table-view twin. */
export function ChartCard({ title, series, data, formatX = (x) => x, children }: ChartCardProps) {
  const [table, setTable] = useState(false);
  const showLegend = series.length >= 2;

  const rows = useMemo(() => data.filter((d) => d.values.some((v) => v > 0)), [data]);

  return (
    <div className="rounded-[18px] border border-line bg-glass p-4 px-[18px] backdrop-blur-[8px]" data-testid="chart-card">
      <div className="mb-3 flex items-center gap-3">
        <p className="font-mono text-[11.5px] tracking-[0.08em] text-muted uppercase">{title}</p>
        {showLegend && (
          <span className="flex items-center gap-3" data-testid="chart-legend">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-[5px] font-mono text-[10.5px] text-faint">
                <i className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
        <button
          onClick={() => setTable((t) => !t)}
          className="ml-auto cursor-pointer font-mono text-[10.5px] text-faint hover:text-cyan"
          data-testid="table-toggle"
        >
          {table ? "◫ chart" : "⊞ table"}
        </button>
      </div>

      {table ? (
        <div className="max-h-56 overflow-y-auto" data-testid="chart-table">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-faint">
                <th className="py-1 pr-3 font-medium">date</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-muted [font-variant-numeric:tabular-nums]">
              {rows.map((d) => (
                <tr key={d.x} className="border-t border-line/50">
                  <td className="py-1 pr-3">{formatX(d.x)}</td>
                  {d.values.map((v, i) => (
                    <td key={i} className="py-1 pr-3 text-right">
                      {v.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-line bg-glass px-[18px] py-4 backdrop-blur-[8px]" data-testid="stat-tile">
      <p className="font-mono text-[11px] text-faint">{label}</p>
      <p className="font-disp text-[26px] leading-tight font-bold text-ink">{value.toLocaleString()}</p>
    </div>
  );
}
