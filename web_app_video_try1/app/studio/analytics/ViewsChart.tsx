"use client";

import { useState } from "react";
import { formatWatch } from "./parts";

type Point = { day: string; value: number };
export type ChartUnit = "views" | "watch";

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (d: string) => dayFormat.format(new Date(`${d}T00:00:00Z`));

function formatValue(value: number, unit: ChartUnit) {
  if (unit === "watch") return formatWatch(value);
  return `${value.toLocaleString("en")} ${value === 1 ? "view" : "views"}`;
}

/**
 * Daily single-series column chart (dataviz spec): columns capped at 24px with
 * 4px rounded tops and square bases, 2px surface gap, one hairline baseline,
 * peak called out in the header, today's column in the live accent, and a
 * per-column tooltip on hover or keyboard focus (hit target = full column).
 */
export function ViewsChart({ points, title, unit = "views" }: { points: Point[]; title: string; unit?: ChartUnit }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 0);
  const top = max || 1;
  const H = 220;
  const last = points.length - 1;
  const peak = unit === "watch" ? `Peak ${formatWatch(max)}/day` : `Peak ${max.toLocaleString("en")}/day`;

  return (
    <figure className="m-0 rounded-[var(--radius-thumb)] border border-line bg-surface/50 px-5 pb-4 pt-4">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <figcaption className="type-label text-fg-faint">{title}</figcaption>
        <p className="type-meta text-fg-muted">{max ? peak : "No data yet"}</p>
      </div>

      <div className="relative" style={{ height: H }}>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line" />
        <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label={title}>
          {points.map((p, i) => {
            const h = (p.value / top) * (H - 8);
            const isActive = active === i;
            const isToday = i === last;
            return (
              <li key={p.day} className="relative flex h-full flex-1 justify-center">
                <button
                  type="button"
                  className="flex h-full w-full items-end justify-center outline-offset-0"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${fmtDay(p.day)}${isToday ? " (today)" : ""}: ${formatValue(p.value, unit)}`}
                >
                  <span
                    className="block w-full max-w-6 rounded-t-[4px] transition-colors"
                    style={{
                      height: p.value > 0 ? Math.max(3, h) : 0,
                      background: isActive || isToday ? "var(--color-accent)" : "var(--color-chart)",
                    }}
                  />
                </button>
                {isActive && (
                  <div
                    role="tooltip"
                    className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-[var(--radius-control)] border border-line-strong bg-raised px-3 py-2 shadow-lg ${
                      i > points.length - 4 ? "right-0" : i < 3 ? "left-0" : "left-1/2 -translate-x-1/2"
                    }`}
                    style={{ bottom: Math.max(3, h) + 10 }}
                  >
                    <p className="type-meta text-fg-muted">
                      {fmtDay(p.day)}
                      {isToday ? ", today" : ""}
                    </p>
                    <p className="type-title tabular-nums text-fg">{formatValue(p.value, unit)}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-2.5 flex justify-between" aria-hidden>
        {[0, Math.floor(points.length / 2), last].map((i) => (
          <span key={i} className="type-meta text-[12px] text-fg-faint">
            {points[i] ? fmtDay(points[i].day) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
