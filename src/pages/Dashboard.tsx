import { BarChart3, ChevronLeft, Gift } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';
import { PERIODS, type Period } from '../lib/taskIcons';
import { TaskPicture } from './KidsTasks';
import { CheckDropdown } from '../components/CheckDropdown';
import { rewardIconUrl, rewardRule, type RewardKind } from '../lib/rewardIcons';

type KidStats = {
  id: string;
  name: string;
  days: { day: string; done: number; total: number; reward: boolean }[];
  periods: Record<Period, { done: number; total: number }>;
  tasks: { id: number; title: string; icon: string; period: Period; archived: boolean; done: number; total: number }[];
  grid: Record<string, Record<number, 'yes' | 'no'>>;
  rewards: {
    id: string;
    title: string;
    icon: string;
    kind: RewardKind;
    min_score: number | null;
    streak_days: number | null;
    earned: number; // days it was earned in the dates chosen
  }[];
  summary: { done: number; total: number; percent: number | null; trackedDays: number };
};

// Categorical series colors (validated palette), assigned by the kid's fixed position in the family
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const md = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

const PRESETS = [
  { key: '1', label: 'Today', days: 1 },
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '14', label: 'Last 14 days', days: 14 },
  { key: '30', label: 'Last 30 days', days: 30 },
];

export default function Dashboard() {
  const { me } = useSession();
  const kids = useMemo(() => (me?.members ?? []).filter((m) => m.role === 'kid'), [me]);
  const colorOf = (id: string) => SERIES[Math.max(0, kids.findIndex((k) => k.id === id)) % SERIES.length];
  const [selected, setSelected] = useState<string[] | null>(null); // null = all kids (the default)
  const [range, setRange] = useState('7');
  const t = today();
  const [from, setFrom] = useState(addDays(t, -6));
  const [to, setTo] = useState(t);
  const [stats, setStats] = useState<KidStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kids.length === 0) return;
    let stale = false;
    setError(null);
    api<{ kids: KidStats[] }>(`/stats?memberIds=${selected ? selected.join(',') : 'all'}&from=${from}&to=${to}`)
      .then((s) => !stale && setStats(s.kids))
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
  }, [kids.length, selected, from, to]);

  const agg = stats && {
    done: stats.reduce((a, k) => a + k.summary.done, 0),
    total: stats.reduce((a, k) => a + k.summary.total, 0),
  };
  // Every chart follows the dates filter; this says which dates are shown
  const rangeText = from === to ? `${weekday(from)} ${md(from)}` : `${md(from)} to ${md(to)}`;

  return (
    <AppLayout title="Dashboard" icon={<BarChart3 className="text-violet" />}>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-xl font-bold text-violet hover:underline">
        <ChevronLeft size={24} /> Family Tasks
      </Link>
      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their statistics.</p>
      ) : (
        <div className="space-y-5">
          {/* Filters: one row */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl bg-soft p-4">
            <div>
              <span className="label">Kids</span>
              <CheckDropdown
                ariaLabel="Kids"
                className="filter-box"
                allLabel="All kids"
                options={kids.map((k) => ({ id: k.id, label: k.name, dot: colorOf(k.id) }))}
                selected={selected}
                onChange={setSelected}
              />
            </div>
            <label>
              <span className="label">Dates</span>
              <select
                className="input filter-box"
                value={range}
                onChange={(e) => {
                  const v = e.target.value;
                  setRange(v);
                  const p = PRESETS.find((x) => x.key === v);
                  if (p) {
                    setTo(t);
                    setFrom(addDays(t, -(p.days - 1)));
                  }
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Choose dates…</option>
              </select>
            </label>
            {range === 'custom' && (
              <div className="flex items-end gap-2">
                <label>
                  <span className="label">From</span>
                  <input type="date" className="input filter-box" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
                </label>
                <label>
                  <span className="label">To</span>
                  <input type="date" className="input filter-box" value={to} min={from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
                </label>
              </div>
            )}
          </div>

          <ErrorBox message={error} />
          {!stats || !agg ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : agg.total === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-lg text-muted">No tasks were on the list in these dates.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Tasks done" value={`${pct(agg.done, agg.total)}%`} sub={`${agg.done} of ${agg.total} tasks, ${rangeText}`} />
                <RewardTiles stats={stats} />
              </div>

              {stats.length > 1 && <Legend kids={stats.map((k) => ({ name: k.name, color: colorOf(k.id) }))} />}

              <div className="grid gap-5 xl:grid-cols-2">
                <LineChart stats={stats} colorOf={colorOf} rangeText={rangeText} />
                <PeriodChart stats={stats} colorOf={colorOf} rangeText={rangeText} />
              </div>

              <TaskRateChart stats={stats} />

              <RewardsTotals stats={stats} colorOf={colorOf} rangeText={rangeText} />
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-soft p-4">
      <div className="text-sm font-bold text-muted">{label}</div>
      <div className="mt-1 text-4xl font-extrabold text-ink">{value}</div>
      <div className="text-muted">{sub}</div>
    </div>
  );
}

/** One tile per reward: on how many days it was earned, added up for the selected kids. */
function RewardTiles({ stats }: { stats: KidStats[] }) {
  const all = new Map<string, { title: string; icon: string; earned: number }>();
  stats.forEach((k) =>
    k.rewards.forEach((r) => {
      const s = all.get(r.id) ?? { title: r.title, icon: r.icon, earned: 0 };
      s.earned += r.earned;
      all.set(r.id, s);
    }),
  );
  if (all.size === 0) return <StatTile label="Rewards earned" value="–" sub="Add rewards in Settings" />;
  return (
    <>
      {[...all.entries()].map(([id, r]) => (
        <div key={id} className="flex items-center gap-3 rounded-2xl bg-sun-soft p-4">
          <img src={rewardIconUrl(r.icon)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-muted">{r.title}</div>
            <div className="text-4xl font-extrabold text-ink tabular-nums">{r.earned}</div>
            <div className="text-muted">{r.earned === 1 ? 'time earned' : 'times earned'}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Small caption under a chart title naming the dates it shows. */
function Range({ text }: { text: string }) {
  return <span className="text-sm font-semibold text-muted">{text}</span>;
}

function Legend({ kids }: { kids: { name: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4" aria-label="Legend">
      {kids.map((k) => (
        <span key={k.name} className="inline-flex items-center gap-2 font-bold text-ink">
          <span className="h-3 w-6 rounded-full" style={{ background: k.color }} />
          {k.name}
        </span>
      ))}
    </div>
  );
}

/** Daily completion %, one line per kid, with a hover crosshair + tooltip. */
function LineChart({ stats, colorOf, rangeText }: { stats: KidStats[]; colorOf: (id: string) => string; rangeText: string }) {
  const days = stats[0].days.map((d) => d.day);
  const W = 640, H = 240, L = 40, R = 12, T = 12, B = 28;
  const x = (i: number) => L + (days.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (days.length - 1));
  const y = (p: number) => T + ((100 - p) * (H - T - B)) / 100;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelEvery = Math.ceil(days.length / 8);

  function onMove(e: React.PointerEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, days.length === 1 ? 0 : i)));
  }

  return (
    <section className="rounded-2xl border-2 border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold">Tasks done per day</h3>
        <Range text={rangeText} />
      </div>
      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Percent of tasks done per day">
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#e7e4f0" />
              <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="12" fill="#6b6880">
                {g}%
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="#6b6880">
                {md(d)}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#6b6880" strokeDasharray="3 3" />}
          {stats.map((k) => {
            const pts = k.days.map((d, i) => (d.total ? `${x(i)},${y(pct(d.done, d.total))}` : null)).filter(Boolean);
            return (
              <g key={k.id}>
                <polyline points={pts.join(' ')} fill="none" stroke={colorOf(k.id)} strokeWidth="2" strokeLinejoin="round" />
                {k.days.map((d, i) =>
                  d.total ? (
                    <circle key={d.day} cx={x(i)} cy={y(pct(d.done, d.total))} r={hover === i ? 6 : 4} fill={colorOf(k.id)} stroke="#fff" strokeWidth="2" />
                  ) : null,
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-line"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > days.length / 2 ? '-105%' : '5%'})` }}
          >
            <div className="font-extrabold">
              {weekday(days[hover])} {md(days[hover])}
            </div>
            {stats.map((k) => {
              const d = k.days[hover];
              return (
                <div key={k.id} className="flex items-center gap-2 whitespace-nowrap">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(k.id) }} />
                  <span className="text-muted">{k.name}</span>
                  <span className="ml-auto font-bold text-ink">{d.total ? `${d.done}/${d.total} (${pct(d.done, d.total)}%)` : '–'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** Completion by Morning / Day / Evening: grouped horizontal bars, one per kid. */
function PeriodChart({ stats, colorOf, rangeText }: { stats: KidStats[]; colorOf: (id: string) => string; rangeText: string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border-2 border-line p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold">By time of day</h3>
        <Range text={rangeText} />
      </div>
      <div className="space-y-4">
        {PERIODS.map((p) => (
          <div key={p.key}>
            <div className="mb-1 flex items-center gap-2 font-bold">
              <TaskPicture icon={p.icon} className="h-6 w-6 rounded" /> {p.label}
            </div>
            <div className="space-y-[2px]">
              {stats.map((k) => {
                const s = k.periods[p.key];
                const v = pct(s.done, s.total);
                const id = `${p.key}-${k.id}`;
                return (
                  <div
                    key={k.id}
                    className="flex items-center gap-2"
                    onPointerEnter={() => setHover(id)}
                    onPointerLeave={() => setHover(null)}
                    title={`${k.name} · ${p.label}: ${s.done} of ${s.total} (${v}%)`}
                  >
                    {stats.length > 1 && <span className="w-20 truncate text-sm text-muted">{k.name}</span>}
                    <div className="h-6 flex-1 rounded-r bg-soft">
                      <div className="h-full rounded-r-[4px] transition-opacity" style={{ width: `${v}%`, minWidth: s.done ? 4 : 0, background: colorOf(k.id), opacity: hover && hover !== id ? 0.5 : 1 }} />
                    </div>
                    <span className="w-28 text-right text-sm font-bold text-ink">{s.total ? `${v}% (${s.done}/${s.total})` : '–'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Rewards per kid: on how many days each reward was earned in the chosen dates (once a day at most). */
function RewardsTotals({ stats, colorOf, rangeText }: { stats: KidStats[]; colorOf: (id: string) => string; rangeText: string }) {
  const all = new Map<string, KidStats['rewards'][number]>();
  stats.forEach((k) => k.rewards.forEach((r) => all.has(r.id) || all.set(r.id, r)));
  const rows = [...all.values()];
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-sun/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-sun-soft px-4 py-3">
        <h3 className="flex items-center gap-2 text-xl font-extrabold">
          <Gift className="text-sun-ink" /> Rewards earned per kid
        </h3>
        <span className="text-sm font-semibold text-muted">Days earned, {rangeText}. Each reward can be earned once a day.</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-muted">No rewards yet. Add them in Settings.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col />
              {stats.map((k) => (
                <col key={k.id} className="w-28" />
              ))}
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-sm">
                <th className="px-4 py-2 font-bold text-muted">Reward</th>
                {stats.map((k) => (
                  <th key={k.id} className="px-3 py-2 text-right font-extrabold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(k.id) }} />
                      {k.name}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-extrabold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const counts = stats.map((k) => k.rewards.find((x) => x.id === r.id)?.earned);
                const total = counts.reduce<number>((a, c) => a + (c ?? 0), 0);
                return (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <img src={rewardIconUrl(r.icon)} alt="" className="h-10 w-10 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-bold">{r.title}</div>
                          <div className="truncate text-sm text-muted">{rewardRule(r)}</div>
                        </div>
                      </div>
                    </td>
                    {counts.map((c, i) => (
                      <td key={stats[i].id} className="px-3 text-right text-xl font-extrabold tabular-nums" title={c === undefined ? 'Not for this kid' : `${stats[i].name}: earned on ${c} ${c === 1 ? 'day' : 'days'}`}>
                        {c === undefined ? <span className="text-muted">–</span> : c}
                      </td>
                    ))}
                    <td className="px-4 text-right text-xl font-extrabold tabular-nums text-sun-ink">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Task rate: a bar chart of how often each task was completed (all selected kids together), best first. */
function TaskRateChart({ stats }: { stats: KidStats[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = new Map<number, { title: string; icon: string; done: number; total: number }>();
  stats.forEach((k) =>
    k.tasks.forEach((t) => {
      const s = totals.get(t.id) ?? { title: t.title, icon: t.icon, done: 0, total: 0 };
      s.done += t.done;
      s.total += t.total;
      totals.set(t.id, s);
    }),
  );
  const rows = [...totals.values()].filter((r) => r.total > 0).sort((a, b) => pct(b.done, b.total) - pct(a.done, a.total));
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border-2 border-line p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold">Task rate</h3>
        <span className="text-muted">How often each task was done. Point at a bar for details.</span>
      </div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: rows.length * 52 }}>
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-x-0 top-6 h-56">
            {[100, 50, 0].map((g) => (
              <div key={g} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${g}%` }}>
                <span className="w-9 text-right text-xs text-muted">{g}%</span>
                <div className="h-px flex-1 bg-line" />
              </div>
            ))}
          </div>
          {/* Bars */}
          <div className="relative ml-11 flex items-end gap-[2px] pt-6" style={{ height: 'calc(14rem + 1.5rem)' }}>
            {rows.map((r, i) => {
              const v = pct(r.done, r.total);
              return (
                <button
                  key={r.title}
                  className="relative flex h-full flex-1 items-end justify-center"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => setHover(i)}
                  aria-label={`${r.title}: done ${r.done} times, ${v}%`}
                >
                  {hover === i && (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-left text-sm shadow-lg ring-1 ring-line ${
                        i > rows.length / 2 ? 'right-0' : 'left-0'
                      }`}
                      style={{ bottom: `calc(${Math.min(v, 80)}% + 26px)` }}
                    >
                      <span className="block font-extrabold text-ink">{r.title}</span>
                      <span className="block text-muted">
                        Done <b className="text-ink">{r.done}</b> {r.done === 1 ? 'time' : 'times'}
                      </span>
                    </span>
                  )}
                  <span className="absolute text-sm font-extrabold tabular-nums text-ink" style={{ bottom: `calc(${v}% + 4px)` }}>
                    {v}%
                  </span>
                  <span
                    className={`block w-full max-w-10 rounded-t-[4px] transition ${hover === i ? 'bg-violet-dark' : 'bg-violet'}`}
                    style={{ height: `${v}%`, minHeight: r.done ? 3 : 0 }}
                  />
                </button>
              );
            })}
          </div>
          {/* Task pictures under the bars */}
          <div className="ml-11 mt-1.5 flex gap-[2px]">
            {rows.map((r) => (
              <span key={r.title} className="flex flex-1 justify-center" title={r.title}>
                <TaskPicture icon={r.icon} className="h-9 w-9 rounded-lg" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
