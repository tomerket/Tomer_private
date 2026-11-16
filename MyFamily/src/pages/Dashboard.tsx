import { BarChart3, Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';
import { PERIODS, type Period } from '../lib/taskIcons';
import { TaskPicture } from './KidsTasks';

type KidStats = {
  id: string;
  name: string;
  days: { day: string; done: number; total: number; reward: boolean }[];
  periods: Record<Period, { done: number; total: number }>;
  tasks: { id: number; title: string; icon: string; period: Period; archived: boolean; done: number; total: number }[];
  grid: Record<string, Record<number, 'yes' | 'no'>>;
  summary: { done: number; total: number; percent: number | null; perfectDays: number; rewardDays: number | null; trackedDays: number };
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
  { key: '7', label: '7 days', days: 7 },
  { key: '14', label: '14 days', days: 14 },
  { key: '30', label: '30 days', days: 30 },
];

export default function Dashboard() {
  const { me } = useSession();
  const kids = useMemo(() => (me?.members ?? []).filter((m) => m.role === 'kid'), [me]);
  const colorOf = (id: string) => SERIES[Math.max(0, kids.findIndex((k) => k.id === id)) % SERIES.length];
  const [selected, setSelected] = useState<string[] | null>(null); // null = all kids
  const t = today();
  const [from, setFrom] = useState(addDays(t, -6));
  const [to, setTo] = useState(t);
  const [stats, setStats] = useState<KidStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

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
  }, [kids.length, selected, from, to, reload]);

  function toggleKid(id: string) {
    const cur = selected ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setSelected(next.length === 0 || next.length === kids.length ? null : next);
  }

  async function removeForKid(kidId: string, taskId: number, title: string, name: string) {
    if (!window.confirm(`Remove "${title}" for ${name}? Other kids keep it.`)) return;
    try {
      await api(`/kids/${kidId}/tasks/${taskId}`, { method: 'DELETE' });
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const activePreset = PRESETS.find((p) => to === t && from === addDays(t, -(p.days - 1)))?.key;
  const agg = stats && {
    done: stats.reduce((a, k) => a + k.summary.done, 0),
    total: stats.reduce((a, k) => a + k.summary.total, 0),
    perfect: stats.reduce((a, k) => a + k.summary.perfectDays, 0),
    tracked: stats.reduce((a, k) => a + k.summary.trackedDays, 0),
    reward: stats.some((k) => k.summary.rewardDays !== null) ? stats.reduce((a, k) => a + (k.summary.rewardDays ?? 0), 0) : null,
  };
  const chip = (active: boolean) =>
    `rounded-full border-2 px-4 py-1.5 font-bold transition ${active ? 'border-violet bg-violet text-white' : 'border-line bg-white text-muted hover:border-violet'}`;

  return (
    <AppLayout title="Dashboard" icon={<BarChart3 className="text-violet" />}>
      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their statistics.</p>
      ) : (
        <div className="space-y-5">
          {/* Filters: one row */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl bg-soft p-4">
            <div>
              <span className="label">Kids</span>
              <div className="flex flex-wrap gap-2">
                <button className={chip(selected === null)} onClick={() => setSelected(null)}>
                  All
                </button>
                {kids.map((k) => (
                  <button key={k.id} className={chip(selected !== null && selected.includes(k.id))} onClick={() => toggleKid(k.id)}>
                    {k.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Dates</span>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={chip(activePreset === p.key)}
                    onClick={() => {
                      setTo(t);
                      setFrom(addDays(t, -(p.days - 1)));
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <input type="date" aria-label="From" className="input !w-auto !py-1.5" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
                <span className="font-bold text-muted">to</span>
                <input type="date" aria-label="To" className="input !w-auto !py-1.5" value={to} min={from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
              </div>
            </div>
          </div>

          <ErrorBox message={error} />
          {!stats || !agg ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : agg.total === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-lg text-muted">No tasks were on the list in these dates.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Tasks done" value={`${pct(agg.done, agg.total)}%`} sub={`${agg.done} of ${agg.total} tasks`} />
                <StatTile label="Perfect days" value={String(agg.perfect)} sub={`of ${agg.tracked} kid-days, all tasks done`} />
                <StatTile
                  label="Reward days"
                  value={agg.reward === null ? '–' : String(agg.reward)}
                  sub={agg.reward === null ? 'Add rewards in Settings' : `of ${agg.tracked} kid-days, reward earned`}
                />
              </div>

              {stats.length > 1 && <Legend kids={stats.map((k) => ({ name: k.name, color: colorOf(k.id) }))} />}

              <div className="grid gap-5 xl:grid-cols-2">
                <LineChart stats={stats} colorOf={colorOf} />
                <PeriodChart stats={stats} colorOf={colorOf} />
              </div>

              {stats.length === 1 ? (
                <TaskGrid kid={stats[0]} onRemove={(id, title) => removeForKid(stats[0].id, id, title, stats[0].name)} />
              ) : (
                <TaskCompare stats={stats} colorOf={colorOf} />
              )}
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
      <div className="text-sm font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-1 text-4xl font-extrabold text-ink">{value}</div>
      <div className="text-muted">{sub}</div>
    </div>
  );
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
function LineChart({ stats, colorOf }: { stats: KidStats[]; colorOf: (id: string) => string }) {
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
      <h3 className="text-xl font-extrabold">Tasks done per day</h3>
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
function PeriodChart({ stats, colorOf }: { stats: KidStats[]; colorOf: (id: string) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border-2 border-line p-4">
      <h3 className="mb-3 text-xl font-extrabold">By time of day</h3>
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

/** One kid: task × day grid. ✓ = yes, empty = no, – = not on the list. */
function TaskGrid({ kid, onRemove }: { kid: KidStats; onRemove: (taskId: number, title: string) => void }) {
  const showGrid = kid.days.length <= 31;
  return (
    <section className="rounded-2xl border-2 border-line p-4 sm:p-5">
      <h3 className="text-xl font-extrabold">{kid.name}: task by task</h3>
      <p className="mb-3 text-muted">
        <Check size={16} strokeWidth={4} className="inline text-violet" /> = Yes (done) · empty = No · – = not on the list ·{' '}
        <X size={14} className="inline" /> = remove this task for {kid.name} only
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-bold">Task</th>
              {showGrid &&
                kid.days.map((d) => (
                  <th key={d.day} className="px-1 py-2 text-center text-xs font-bold leading-tight text-muted">
                    {weekday(d.day)}
                    <br />
                    {md(d.day)}
                  </th>
                ))}
              <th className="px-2 py-2 text-right font-bold">Done</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => {
              const list = kid.tasks.filter((x) => x.period === p.key);
              if (!list.length) return null;
              return [
                <tr key={p.key}>
                  <td colSpan={showGrid ? kid.days.length + 3 : 3} className="bg-soft px-2 py-1 text-sm font-extrabold uppercase tracking-widest text-muted">
                    {p.label}
                  </td>
                </tr>,
                ...list.map((task) => (
                  <tr key={task.id}>
                    <td className="sticky left-0 z-10 border-b border-line bg-white py-1.5 pr-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <TaskPicture icon={task.icon} className="h-9 w-9 rounded-lg" />
                        <span className={`font-semibold ${task.archived ? 'text-muted line-through' : ''}`}>{task.title}</span>
                      </div>
                    </td>
                    {showGrid &&
                      kid.days.map((d) => {
                        const v = kid.grid[d.day]?.[task.id];
                        return (
                          <td key={d.day} className="border-b border-line px-1 text-center" title={v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not on the list'}>
                            {v === 'yes' ? (
                              <span className="inline-grid h-6 w-6 place-items-center rounded-md bg-violet">
                                <Check size={16} strokeWidth={4} className="text-white" />
                              </span>
                            ) : v === 'no' ? (
                              <span className="inline-block h-6 w-6 rounded-md border-2 border-line" />
                            ) : (
                              <span className="text-muted">–</span>
                            )}
                          </td>
                        );
                      })}
                    <td className="whitespace-nowrap border-b border-line px-2 text-right font-bold">
                      {task.done}/{task.total}
                    </td>
                    <td className="border-b border-line text-center">
                      {!task.archived && (
                        <button aria-label={`Remove ${task.title} for ${kid.name}`} title={`Remove for ${kid.name}`} className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-danger" onClick={() => onRemove(task.id, task.title)}>
                          <X size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Several kids: each task's completion per kid (table view). */
function TaskCompare({ stats, colorOf }: { stats: KidStats[]; colorOf: (id: string) => string }) {
  const tasks = new Map<number, KidStats['tasks'][number]>();
  stats.forEach((k) => k.tasks.forEach((x) => tasks.has(x.id) || tasks.set(x.id, x)));
  return (
    <section className="rounded-2xl border-2 border-line p-4 sm:p-5">
      <h3 className="text-xl font-extrabold">Task by task</h3>
      <p className="mb-3 text-muted">Done / days on the list. Pick one kid above to see each day and to remove a task for that kid.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="py-2 pr-3 font-bold">Task</th>
              {stats.map((k) => (
                <th key={k.id} className="px-2 py-2 text-right font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(k.id) }} />
                    {k.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...tasks.values()].map((task) => (
              <tr key={task.id}>
                <td className="border-b border-line py-1.5 pr-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <TaskPicture icon={task.icon} className="h-8 w-8 rounded-lg" />
                    <span className="font-semibold">{task.title}</span>
                  </div>
                </td>
                {stats.map((k) => {
                  const s = k.tasks.find((x) => x.id === task.id);
                  return (
                    <td key={k.id} className="whitespace-nowrap border-b border-line px-2 text-right font-bold">
                      {s ? `${s.done}/${s.total} (${pct(s.done, s.total)}%)` : <span className="text-muted">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
