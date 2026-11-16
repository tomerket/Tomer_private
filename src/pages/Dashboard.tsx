import { BarChart3, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';
import { PERIODS, type Period } from '../lib/taskIcons';
import { TaskPicture } from './KidsTasks';

type Stats = {
  days: { day: string; done: number; total: number }[];
  tasks: { id: number; title: string; icon: string; period: Period; archived: boolean; done: number; total: number }[];
  grid: Record<string, Record<number, 'yes' | 'no'>>;
  summary: { done: number; total: number; percent: number | null; perfectDays: number; trackedDays: number };
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const md = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

const PRESETS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '14', label: 'Last 14 days', days: 14 },
  { key: '30', label: 'Last 30 days', days: 30 },
];

export default function Dashboard() {
  const { me } = useSession();
  const kids = (me?.members ?? []).filter((m) => m.role === 'kid');
  const [kidId, setKidId] = useState(kids[0]?.id ?? '');
  const t = today();
  const [from, setFrom] = useState(addDays(t, -6));
  const [to, setTo] = useState(t);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!kidId) return;
    let stale = false;
    setError(null);
    setStats(null);
    api<Stats>(`/stats?memberId=${kidId}&from=${from}&to=${to}`)
      .then((s) => !stale && setStats(s))
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
  }, [kidId, from, to]);

  const activePreset = PRESETS.find((p) => to === t && from === addDays(t, -(p.days - 1)))?.key;
  const showGrid = (stats?.days.length ?? 0) <= 31;
  const hovered = hover !== null ? stats?.days[hover] : null;
  const tasksByPeriod = useMemo(
    () => PERIODS.map((p) => ({ ...p, tasks: stats?.tasks.filter((x) => x.period === p.key) ?? [] })),
    [stats],
  );

  return (
    <AppLayout title="Dashboard" icon={<BarChart3 className="text-violet" />}>
      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their statistics.</p>
      ) : (
        <div className="space-y-6">
          {/* Filters: one row */}
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-soft p-4">
            <label className="min-w-[160px] flex-1 sm:flex-none">
              <span className="label">Name</span>
              <select className="input" value={kidId} onChange={(e) => setKidId(e.target.value)}>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setTo(t);
                    setFrom(addDays(t, -(p.days - 1)));
                  }}
                  className={`rounded-lg px-3 py-2 font-bold transition ${activePreset === p.key ? 'bg-violet text-white' : 'text-muted hover:bg-soft'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label>
              <span className="label">From</span>
              <input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            <label>
              <span className="label">To</span>
              <input type="date" className="input" value={to} min={from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </label>
          </div>

          <ErrorBox message={error} />
          {!stats ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : stats.summary.total === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-lg text-muted">No tasks were on the list in these dates.</div>
          ) : (
            <>
              {/* Stat tiles */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Tasks done" value={`${stats.summary.percent}%`} sub={`${stats.summary.done} of ${stats.summary.total} tasks`} />
                <StatTile label="Perfect days" value={String(stats.summary.perfectDays)} sub={`of ${stats.summary.trackedDays} days, all tasks done`} />
                <StatTile
                  label="Best task"
                  value={[...stats.tasks].sort((a, b) => pct(b.done, b.total) - pct(a.done, a.total))[0]?.title ?? '-'}
                  sub="highest completion"
                  small
                />
              </div>

              {/* Daily completion chart (single series) */}
              <section className="rounded-2xl border-2 border-line p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-xl font-extrabold">Tasks done per day</h3>
                  <span className="text-muted" aria-live="polite">
                    {hovered
                      ? `${weekday(hovered.day)} ${md(hovered.day)}: ${hovered.done} of ${hovered.total} (${pct(hovered.done, hovered.total)}%)`
                      : 'Hover or tap a bar for details'}
                  </span>
                </div>
                <div className="relative h-48">
                  {[100, 50, 0].map((g) => (
                    <div key={g} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${g}%` }}>
                      <span className="w-9 text-right text-xs text-muted">{g}%</span>
                      <div className="h-px flex-1 bg-line" />
                    </div>
                  ))}
                  <div className="absolute inset-y-0 left-11 right-0 flex items-end gap-[2px]">
                    {stats.days.map((d, i) => (
                      <button
                        key={d.day}
                        className="group relative flex h-full flex-1 items-end"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setHover(i)}
                        aria-label={`${md(d.day)}: ${d.done} of ${d.total}`}
                      >
                        <div
                          className={`w-full rounded-t-[4px] transition ${hover === i ? 'bg-violet-dark' : 'bg-violet'}`}
                          style={{ height: `${pct(d.done, d.total)}%`, minHeight: d.total ? 2 : 0 }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ml-11 mt-1 flex gap-[2px] text-xs text-muted">
                  {stats.days.map((d, i) => (
                    <span key={d.day} className="flex-1 text-center">
                      {stats.days.length <= 14 || i % Math.ceil(stats.days.length / 10) === 0 ? md(d.day) : ''}
                    </span>
                  ))}
                </div>
              </section>

              {/* Yes / No table: ✓ = done (yes), empty = not done (no) */}
              <section className="rounded-2xl border-2 border-line p-4 sm:p-5">
                <h3 className="text-xl font-extrabold">Task by task</h3>
                <p className="mb-3 text-muted">
                  <Check size={16} strokeWidth={4} className="inline text-violet" /> = Yes (done) · empty = No · – = task was not on the list
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-left">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-bold">Task</th>
                        {showGrid &&
                          stats.days.map((d) => (
                            <th key={d.day} className="px-1 py-2 text-center text-xs font-bold leading-tight text-muted">
                              {weekday(d.day)}
                              <br />
                              {md(d.day)}
                            </th>
                          ))}
                        <th className="px-2 py-2 text-right font-bold">Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksByPeriod.map((p) =>
                        p.tasks.length === 0 ? null : (
                          <PeriodRows key={p.key} label={p.label} tasks={p.tasks} days={stats.days} grid={stats.grid} showGrid={showGrid} />
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function StatTile({ label, value, sub, small = false }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-soft p-4">
      <div className="text-sm font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className={`mt-1 truncate font-extrabold text-ink ${small ? 'text-2xl' : 'text-4xl'}`}>{value}</div>
      <div className="text-muted">{sub}</div>
    </div>
  );
}

function PeriodRows({
  label,
  tasks,
  days,
  grid,
  showGrid,
}: {
  label: string;
  tasks: Stats['tasks'];
  days: Stats['days'];
  grid: Stats['grid'];
  showGrid: boolean;
}) {
  return (
    <>
      <tr>
        <td colSpan={showGrid ? days.length + 2 : 2} className="bg-soft px-2 py-1 text-sm font-extrabold uppercase tracking-widest text-muted">
          {label}
        </td>
      </tr>
      {tasks.map((task) => (
        <tr key={task.id}>
          <td className="sticky left-0 z-10 border-b border-line bg-white py-1.5 pr-3">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <TaskPicture icon={task.icon} className="h-7 w-7" />
              <span className={`font-semibold ${task.archived ? 'text-muted line-through' : ''}`}>{task.title}</span>
            </div>
          </td>
          {showGrid &&
            days.map((d) => {
              const v = grid[d.day]?.[task.id];
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
        </tr>
      ))}
    </>
  );
}
