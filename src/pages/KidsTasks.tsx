import { Check, ChevronLeft, ChevronRight, Gift, Lock, Smile } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useRoles, useSession } from '../lib/session';
import { PERIODS, taskIconUrl, type Period } from '../lib/taskIcons';

type Task = { id: number; title: string; icon: string; period: Period; sort_order: number; checked: boolean };
type Reward = { id: string; title: string; min_score: number };

const DAYS_BACK = 5;

/** Section look: background, heading color and tile accent. */
const SECTION_STYLE: Record<Period, { bg: string; heading: string; accent: string }> = {
  morning: { bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', heading: '#92400E', accent: '#F59E0B' },
  general: { bg: 'linear-gradient(135deg, #E0F2FE 0%, #CCFBF1 100%)', heading: '#075985', accent: '#0EA5E9' },
  evening: { bg: 'linear-gradient(135deg, #312E81 0%, #1E1B4B 100%)', heading: '#FFFFFF', accent: '#8B5CF6' },
};

export function TaskPicture({ icon, className }: { icon: string; className?: string }) {
  const url = taskIconUrl(icon);
  return url ? (
    <img src={url} alt="" className={`object-cover ${className ?? ''}`} draggable={false} />
  ) : (
    <span className={`grid place-items-center text-4xl ${className ?? ''}`}>{icon}</span>
  );
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayLabel(iso: string, todayIso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const md = `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
  if (iso === todayIso) return `Today · ${md}`;
  if (iso === addDays(todayIso, -1)) return `Yesterday · ${md}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'long' })} · ${md}`;
}

export default function KidsTasks() {
  const { me } = useSession();
  const { isKid, isParent } = useRoles();
  // Kids only ever see themselves; parents see every kid
  const kids = (me?.members ?? []).filter((m) => m.role === 'kid' && (!isKid || m.id === me?.member?.id));
  const [kidId, setKidId] = useState<string | null>(kids[0]?.id ?? null);
  const todayIso = today();
  const [day, setDay] = useState(todayIso);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const minDay = addDays(todayIso, -DAYS_BACK);
  // Kids can tick today only; parents can also fix the last 5 days
  const canEdit = day === todayIso || isParent;

  const load = useCallback(async () => {
    if (!kidId) return;
    setTasks(null);
    setError(null);
    try {
      const r = await api<{ tasks: Task[]; rewards: Reward[] }>(`/kids/${kidId}/tasks?day=${day}`);
      setTasks(r.tasks);
      setRewards(r.rewards);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kidId, day]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: Task) {
    if (!canEdit) return;
    const checked = !t.checked;
    setTasks((list) => list?.map((x) => (x.id === t.id ? { ...x, checked } : x)) ?? null);
    try {
      await api(`/kids/${kidId}/tasks/${t.id}`, { method: 'PUT', body: { day, checked } });
    } catch (e) {
      setError((e as Error).message);
      setTasks((list) => list?.map((x) => (x.id === t.id ? { ...x, checked: !checked } : x)) ?? null);
    }
  }

  const done = tasks?.filter((t) => t.checked).length ?? 0;
  const total = tasks?.length ?? 0;
  const allDone = total > 0 && done === total;
  const kidName = kids.find((k) => k.id === kidId)?.name;
  // Next reward not reached yet, or the best one reached
  const reached = rewards.filter((r) => done >= Math.min(r.min_score, total));
  const nextReward = rewards.find((r) => done < Math.min(r.min_score, total));
  const bestReached = reached[reached.length - 1];

  return (
    <AppLayout title="Kids Tasks" icon={<Smile className="text-violet" />} fill>
      {/* Top row: back · kids · date navigation */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link to="/tasks" className="mr-2 inline-flex items-center gap-1 text-lg font-bold text-violet hover:underline">
          <ChevronLeft size={22} /> Family Tasks
        </Link>
        {kids.length > 1 &&
          kids.map((k) => (
            <button
              key={k.id}
              onClick={() => setKidId(k.id)}
              className={`rounded-full px-5 py-1.5 text-lg font-bold transition ${
                k.id === kidId ? 'bg-violet text-white shadow' : 'bg-soft text-ink hover:bg-violet-soft'
              }`}
            >
              {k.name}
            </button>
          ))}
        <div className="ml-auto flex items-center gap-1 rounded-xl bg-soft p-1">
          <button
            aria-label="Previous day"
            className="rounded-lg p-2 text-violet transition hover:bg-white disabled:opacity-30"
            disabled={day <= minDay}
            onClick={() => setDay((d) => addDays(d, -1))}
          >
            <ChevronLeft size={24} />
          </button>
          <span className="min-w-[160px] text-center text-lg font-extrabold">{dayLabel(day, todayIso)}</span>
          <button
            aria-label="Next day"
            className="rounded-lg p-2 text-violet transition hover:bg-white disabled:opacity-30"
            disabled={day >= todayIso}
            onClick={() => setDay((d) => addDays(d, 1))}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">There are no kids in this family yet.</p>
      ) : (
        <>
          {/* Progress + reward */}
          <div className={`mb-4 rounded-2xl px-5 py-3 ${allDone ? 'hero-gradient text-white' : 'bg-soft'}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-2xl font-extrabold sm:text-3xl">
                {allDone ? `Amazing, ${kidName}! All done! 🎉` : `${kidName}'s tasks`}
              </span>
              {!canEdit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-0.5 text-sm font-bold text-muted">
                  <Lock size={14} /> View only
                </span>
              )}
              <span className={`ml-auto text-3xl font-extrabold sm:text-4xl ${allDone ? '' : 'text-violet'}`}>
                {done}/{total}
              </span>
            </div>
            <div className={`mt-2 h-4 overflow-hidden rounded-full ${allDone ? 'bg-white/30' : 'bg-white'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-white' : 'bg-gradient-to-r from-cyan to-violet'}`}
                style={{ width: total ? `${(done / total) * 100}%` : 0 }}
              />
            </div>
            {rewards.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-bold">
                <Gift size={22} className={allDone ? '' : 'text-violet'} />
                {bestReached && <span>Reward earned: {bestReached.title}! 🏆</span>}
                {nextReward && (
                  <span className={allDone ? '' : 'text-muted'}>
                    {bestReached ? 'Next: ' : 'Reward: '}
                    {nextReward.title}, {Math.min(nextReward.min_score, total) - done} more to go ({Math.min(nextReward.min_score, total)}/{total})
                  </span>
                )}
              </div>
            )}
          </div>

          <ErrorBox message={error} />

          {!tasks ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              {PERIODS.map((p) => {
                const list = tasks.filter((t) => t.period === p.key);
                if (list.length === 0) return null;
                const s = SECTION_STYLE[p.key];
                const sDone = list.filter((t) => t.checked).length;
                return (
                  /* One horizontal band per time of day: label on the left, tasks side by side */
                  <section key={p.key} className="flex flex-col gap-3 rounded-3xl p-3 sm:flex-row sm:items-stretch sm:p-4" style={{ background: s.bg }}>
                    <h2
                      className="flex shrink-0 items-center gap-2 text-xl font-extrabold uppercase tracking-wide sm:w-36 sm:flex-col sm:justify-center sm:text-center"
                      style={{ color: s.heading }}
                    >
                      <TaskPicture icon={p.icon} className="h-10 w-10 rounded-full sm:h-14 sm:w-14" />
                      <span className="leading-tight">{p.label}</span>
                      <span className="ml-auto text-lg sm:ml-0">
                        {sDone}/{list.length}
                      </span>
                    </h2>
                    <div className="flex flex-1 gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:overflow-visible sm:pb-0">
                      {list.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => toggle(t)}
                          aria-pressed={t.checked}
                          disabled={!canEdit}
                          className="relative flex w-36 shrink-0 flex-col items-center gap-1.5 rounded-2xl border-[3px] bg-white p-2.5 text-center shadow-sm transition active:scale-[0.97] disabled:cursor-default sm:w-auto"
                          style={{ borderColor: t.checked ? s.accent : 'transparent' }}
                        >
                          <TaskPicture icon={t.icon} className={`h-16 w-16 rounded-xl transition ${t.checked ? 'opacity-50' : ''}`} />
                          <span className={`text-lg font-bold leading-tight ${t.checked ? 'text-muted' : ''}`}>{t.title}</span>
                          <span
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border-[3px] transition"
                            style={{ borderColor: s.accent, background: t.checked ? s.accent : '#fff' }}
                          >
                            {t.checked && <Check size={20} strokeWidth={4} className="text-white" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
