import { BarChart3, Check, ChevronDown, Gift, Trophy, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Avatar } from '../components/Face';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';
import { PERIODS, type Period } from '../lib/taskIcons';
import { SECTION_STYLE, TaskPicture } from './KidsTasks';

type KidStats = {
  id: string;
  name: string;
  days: { day: string; done: number; total: number; reward: boolean }[];
  periods: Record<Period, { done: number; total: number }>;
  tasks: { id: number; title: string; icon: string; period: Period; archived: boolean; done: number; total: number }[];
  grid: Record<string, Record<number, 'yes' | 'no'>>;
  rewards: { id: string; title: string; min_score: number; earnedDays: number }[];
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
  const [selected, setSelected] = useState<string[] | null>(() => (kids[0] ? [kids[0].id] : null)); // null = all kids
  const [range, setRange] = useState('7');
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
    const cur = selected ?? kids.map((k) => k.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (next.length === 0) return; // keep at least one kid
    setSelected(next.length === kids.length ? null : next);
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

  const agg = stats && {
    done: stats.reduce((a, k) => a + k.summary.done, 0),
    total: stats.reduce((a, k) => a + k.summary.total, 0),
    perfect: stats.reduce((a, k) => a + k.summary.perfectDays, 0),
    tracked: stats.reduce((a, k) => a + k.summary.trackedDays, 0),
    reward: stats.some((k) => k.summary.rewardDays !== null) ? stats.reduce((a, k) => a + (k.summary.rewardDays ?? 0), 0) : null,
  };

  return (
    <AppLayout title="Dashboard" icon={<BarChart3 className="text-violet" />}>
      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their statistics.</p>
      ) : (
        <div className="space-y-5">
          {/* Filters: one row */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl bg-soft p-4">
            <div>
              <span className="label">Kids</span>
              <KidsDropdown
                kids={kids.map((k) => ({ id: k.id, name: k.name, color: colorOf(k.id) }))}
                selected={selected}
                onToggle={toggleKid}
                onAll={() => setSelected(null)}
              />
            </div>
            <label>
              <span className="label">Dates</span>
              <select
                className="input !w-auto !py-2 font-bold"
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
                    Last {p.label}
                  </option>
                ))}
                <option value="custom">Choose dates…</option>
              </select>
            </label>
            {range === 'custom' && (
              <div className="flex items-end gap-2">
                <label>
                  <span className="label">From</span>
                  <input type="date" className="input !w-auto !py-2" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
                </label>
                <label>
                  <span className="label">To</span>
                  <input type="date" className="input !w-auto !py-2" value={to} min={from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
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

              <RewardsSummary stats={stats} />

              <TaskPercent stats={stats} colorOf={colorOf} onRemove={removeForKid} />
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

/** Each kid's rewards and how many days in the chosen dates they earned each one. */
function RewardsSummary({ stats }: { stats: KidStats[] }) {
  const { me } = useSession();
  const photo = (id: string) => me?.members.find((m) => m.id === id)?.photoUrl;
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xl font-extrabold">
        <Gift className="text-amber-500" /> Rewards
      </h3>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((k) => (
          <div key={k.id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-lg font-extrabold">
              <Avatar name={k.name} photoUrl={photo(k.id)} role="kid" size={34} /> {k.name}
            </div>
            {k.rewards.length === 0 ? (
              <p className="text-muted">No rewards for {k.name} yet (add them in Settings).</p>
            ) : (
              <ul className="space-y-1.5">
                {k.rewards.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Trophy size={18} className={r.earnedDays ? 'text-amber-500' : 'text-muted'} />
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{r.title}</span> <span className="text-sm text-muted">· {r.min_score} tasks/day</span>
                    </span>
                    <span className="whitespace-nowrap font-extrabold text-ink">
                      earned {r.earnedDays}/{k.summary.trackedDays} days
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Kids picker: a dropdown list where each name is ticked (✓) on or off. */
function KidsDropdown({
  kids,
  selected,
  onToggle,
  onAll,
}: {
  kids: { id: string; name: string; color: string }[];
  selected: string[] | null;
  onToggle: (id: string) => void;
  onAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const isOn = (id: string) => selected === null || selected.includes(id);
  const label = selected === null ? 'All kids' : kids.filter((k) => selected.includes(k.id)).map((k) => k.name).join(', ');
  const box = (on: boolean) => (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-violet bg-violet' : 'border-line bg-white'}`}>
      {on && <Check size={16} strokeWidth={4} className="text-white" />}
    </span>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="input flex !w-auto min-w-[200px] max-w-[320px] items-center gap-2 !py-2 text-left font-bold"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={18} className="ml-auto shrink-0 text-muted" />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl bg-white p-2 shadow-xl ring-1 ring-line">
          <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 font-bold hover:bg-soft" onClick={onAll}>
            {box(selected === null)} All kids
          </button>
          <div className="my-1 h-px bg-line" />
          {kids.map((k) => (
            <button key={k.id} type="button" role="option" aria-selected={isOn(k.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 font-semibold hover:bg-soft" onClick={() => onToggle(k.id)}>
              {box(isOn(k.id))}
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
              {k.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Task by task: % done per kid, grouped into Morning / During the day / Evening in their colors. */
function TaskPercent({
  stats,
  colorOf,
  onRemove,
}: {
  stats: KidStats[];
  colorOf: (id: string) => string;
  onRemove: (kidId: string, taskId: number, title: string, name: string) => void;
}) {
  const all = new Map<number, KidStats['tasks'][number]>();
  stats.forEach((k) => k.tasks.forEach((x) => all.has(x.id) || all.set(x.id, x)));
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-extrabold">Task by task (% done)</h3>
      {PERIODS.map((p) => {
        const list = [...all.values()].filter((x) => x.period === p.key);
        if (!list.length) return null;
        const s = SECTION_STYLE[p.key];
        return (
          <div key={p.key} className="overflow-hidden rounded-2xl" style={{ background: s.bg }}>
            <div className="flex items-center gap-2 px-4 py-2 text-lg font-extrabold uppercase tracking-wide" style={{ color: s.heading }}>
              <TaskPicture icon={p.icon} className="h-8 w-8 rounded-full" /> {p.label}
            </div>
            <div className="overflow-x-auto bg-white/90">
              <table className="w-full text-left">
                {stats.length > 1 && (
                  <thead>
                    <tr className="text-sm text-muted">
                      <th className="px-4 py-2 font-bold">Task</th>
                      {stats.map((k) => (
                        <th key={k.id} className="px-3 py-2 font-bold">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(k.id) }} />
                            {k.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {list.map((task) => (
                    <tr key={task.id} className="border-t border-line">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <TaskPicture icon={task.icon} className="h-9 w-9 rounded-lg" />
                          <span className={`font-semibold ${task.archived ? 'text-muted line-through' : ''}`}>{task.title}</span>
                        </div>
                      </td>
                      {stats.map((k) => {
                        const st = k.tasks.find((x) => x.id === task.id);
                        if (!st) return <td key={k.id} className="px-3 text-muted">–</td>;
                        const v = pct(st.done, st.total);
                        return (
                          <td key={k.id} className="px-3" title={`${k.name}: done ${st.done} of ${st.total} days`}>
                            <div className="flex items-center gap-2">
                              <span className="w-14 text-right text-lg font-extrabold text-ink">{v}%</span>
                              {!task.archived && (
                                <button
                                  aria-label={`Remove ${task.title} for ${k.name}`}
                                  title={`Remove for ${k.name}`}
                                  className="rounded-md p-1 text-muted hover:bg-soft hover:text-danger"
                                  onClick={() => onRemove(k.id, task.id, task.title, k.name)}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
