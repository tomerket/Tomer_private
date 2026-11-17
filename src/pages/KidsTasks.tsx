import { Check, ChevronDown, ChevronLeft, ChevronRight, Gift, Lock, Smile, Trophy, X } from 'lucide-react';
import { useIsPhone } from '../lib/useMedia';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Avatar } from '../components/Face';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useRoles, useSession } from '../lib/session';
import { rewardIconUrl, rewardRule, type RewardKind } from '../lib/rewardIcons';
import { PERIODS, taskIconUrl, type Period } from '../lib/taskIcons';

type Task = { id: number; title: string; icon: string; period: Period; sort_order: number; mandatory: boolean; checked: boolean };
type Reward = {
  id: string;
  title: string;
  icon: string;
  kind: RewardKind;
  min_score: number | null;
  streak_days: number | null;
};

const DAYS_BACK = 5;

/** Section look: background, heading color and tile accent. */
export const SECTION_STYLE: Record<Period, { bg: string; heading: string; accent: string }> = {
  morning: { bg: '#FFF3D1', heading: '#8A5200', accent: '#6D3BF5' },
  general: { bg: '#E2F6FC', heading: '#0B5E7A', accent: '#6D3BF5' },
  evening: { bg: '#2A1F66', heading: '#FFFFFF', accent: '#6D3BF5' },
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
  if (iso === todayIso) return `Today, ${md}`;
  if (iso === addDays(todayIso, -1)) return `Yesterday, ${md}`;
  return `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${md}`;
}

export default function KidsTasks() {
  const { me } = useSession();
  const { isKid, isParent } = useRoles();
  // Kids only ever see themselves; parents see every kid
  const kids = (me?.members ?? []).filter((m) => m.role === 'kid' && (!isKid || m.id === me?.member?.id));
  const [kidId, setKidId] = useState<string | null>(kids[0]?.id ?? null);
  const todayIso = today();
  const [day, setDay] = useState(todayIso);
  const isPhone = useIsPhone();
  // Phones: the part of the day it is now starts open; the others open with a tap
  const [openPeriods, setOpenPeriods] = useState<Set<Period>>(() => {
    const h = new Date().getHours();
    return new Set<Period>([h < 12 ? 'morning' : h < 17 ? 'general' : 'evening']);
  });
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRewards, setShowRewards] = useState(false);
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
  const mustDoLeft = (tasks ?? []).filter((t) => t.mandatory && !t.checked).length;
  // Rewards are per day: worked out only from the tasks of the day shown (today by default)
  // Earned only with at least the reward's number of tasks done, plus every must-do task
  const isEarned = (r: Reward) => total > 0 && mustDoLeft === 0 && done >= r.min_score!;
  const reached = rewards.filter(isEarned);
  const nextReward = rewards.find((r) => !isEarned(r));
  const bestReached = reached[reached.length - 1];

  return (
    <AppLayout title="Kids Tasks" icon={<Smile className="text-violet" />} fill>
      {showRewards && (
        <RewardsDialog
          kidName={kidName ?? ''}
          dayText={dayLabel(day, todayIso)}
          rewards={rewards}
          done={done}
          total={total}
          mustDoLeft={mustDoLeft}
          isEarned={isEarned}
          onClose={() => setShowRewards(false)}
        />
      )}
      {/* Top row: back · kids · date navigation */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link to="/tasks" className="mr-2 inline-flex items-center gap-1 text-lg font-bold text-violet hover:underline">
          <ChevronLeft size={22} /> Family Tasks
        </Link>
        {/* Phones: kids on their own rows, 3 per row; bigger screens: inline as before */}
        {kids.length > 1 && (
          <div className="grid w-full grid-cols-3 gap-1.5 sm:contents">
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setKidId(k.id)}
                className={`flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm font-bold transition sm:gap-2 sm:pr-4 sm:text-lg ${
                  k.id === kidId ? 'bg-violet text-white shadow' : 'bg-soft text-ink hover:bg-violet-soft'
                }`}
              >
                <span className="flex shrink-0 sm:hidden">
                  <Avatar name={k.name} photoUrl={k.photoUrl} role="kid" size={26} />
                </span>
                <span className="hidden shrink-0 sm:flex">
                  <Avatar name={k.name} photoUrl={k.photoUrl} role="kid" size={32} />
                </span>
                <span className="min-w-0 truncate">{k.name}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className="btn ml-auto bg-sun-soft px-4 py-2.5 text-sun-ink hover:bg-sun"
          onClick={() => setShowRewards(true)}
          disabled={kids.length === 0}
        >
          <Gift size={22} /> Rewards
          {reached.length > 0 && <span className="rounded-full bg-sun px-2 text-sm text-white">{reached.length}</span>}
        </button>
        <div className="flex items-center gap-1 rounded-xl bg-soft p-1">
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
          {/* Sticker strip: each finished task adds its own picture */}
          <div className={`lift mb-3 rounded-[22px] px-3 py-2.5 sm:mb-4 sm:rounded-[28px] sm:px-5 sm:py-4 ${allDone ? 'hero-gradient text-white' : 'bg-white'}`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-lg font-extrabold leading-tight sm:text-3xl">
                {allDone
                  ? `Amazing, ${kidName}! All done! 🎉`
                  : nextReward
                    ? nextReward.min_score! - done > 0
                      ? `${kidName}, ${nextReward.min_score! - done} more for ${nextReward.title}`
                      : `${kidName}, finish the must-do tasks for ${nextReward.title}`
                    : `${kidName}'s tasks`}
              </span>
              {!canEdit && (
                <span className="inline-flex items-center gap-1 rounded-full bg-soft px-3 py-0.5 text-sm font-bold text-muted">
                  <Lock size={14} /> View only
                </span>
              )}
              <span className={`ml-auto text-2xl font-extrabold tabular-nums sm:text-4xl ${allDone ? '' : 'text-violet'}`}>
                {done}/{total}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 sm:mt-3 sm:gap-1.5" aria-label={`${done} of ${total} tasks done`}>
              {(tasks ?? []).map((t) =>
                t.checked ? (
                  <TaskPicture
                    key={t.id}
                    icon={t.icon}
                    className={`h-7 w-7 rounded-full border-2 bg-white sm:h-10 sm:w-10 sm:border-[3px] ${allDone ? 'border-white' : 'border-violet'}`}
                  />
                ) : (
                  <span key={t.id} title={t.title} className="h-7 w-7 rounded-full border-2 border-dashed border-line bg-soft sm:h-10 sm:w-10" />
                ),
              )}
            </div>
            {bestReached && (
              <div className="mt-1.5 flex items-center gap-2 text-base font-bold sm:mt-2 sm:text-lg">
                <Gift size={22} className={allDone ? '' : 'text-sun'} /> Reward earned: {bestReached.title}! 🏆
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
                if (isPhone) {
                  const open = openPeriods.has(p.key);
                  return (
                    /* Phones: a small band that opens with a tap, tasks 3 to a row */
                    <section key={p.key} className="rounded-[22px] p-2" style={{ background: s.bg }}>
                      <button
                        className="flex w-full items-center gap-2 rounded-2xl px-1 py-1 text-left"
                        style={{ color: s.heading }}
                        aria-expanded={open}
                        onClick={() =>
                          setOpenPeriods((o) => {
                            const n = new Set(o);
                            if (n.has(p.key)) n.delete(p.key);
                            else n.add(p.key);
                            return n;
                          })
                        }
                      >
                        <TaskPicture icon={p.icon} className="h-8 w-8 shrink-0 rounded-full" />
                        <span className="text-lg font-extrabold leading-tight">{p.label}</span>
                        {!open && (
                          // Closed: a row of tiny pictures, the done ones ringed
                          <span className="flex min-w-0 flex-1 gap-1 overflow-hidden px-1" aria-hidden>
                            {list.map((t) => (
                              <TaskPicture
                                key={t.id}
                                icon={t.icon}
                                className={`h-6 w-6 shrink-0 rounded-full bg-white ${t.checked ? 'ring-2 ring-violet' : 'opacity-50'}`}
                              />
                            ))}
                          </span>
                        )}
                        <span className={`shrink-0 font-extrabold ${open ? 'ml-auto' : ''}`}>
                          {sDone}/{list.length}
                        </span>
                        <ChevronDown size={20} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {open && (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {list.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => toggle(t)}
                              aria-pressed={t.checked}
                              disabled={!canEdit}
                              className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white px-1 pb-1.5 pt-2 text-center transition active:scale-[0.97] disabled:cursor-default ${
                                t.checked ? 'border-violet' : 'border-line'
                              }`}
                            >
                              <TaskPicture icon={t.icon} className={`h-11 w-11 rounded-xl ${t.checked ? 'opacity-55' : ''}`} />
                              <span className={`line-clamp-2 font-display text-[13px] font-bold leading-tight ${t.checked ? 'text-muted' : ''}`}>{t.title}</span>
                              {t.mandatory && <span className="absolute left-1 top-1 h-2.5 w-2.5 rounded-full bg-danger" title="Must do" aria-label="Must do" />}
                              <span className="stamp stamp-sm absolute right-1 top-1 h-6 w-6" data-on={t.checked}>
                                {t.checked && <Check size={12} strokeWidth={4} className="text-white" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                }
                return (
                  /* One horizontal band per time of day: label on the left, tasks side by side */
                  <section key={p.key} className="flex flex-col gap-3 rounded-[28px] p-3 sm:flex-row sm:items-stretch sm:p-4" style={{ background: s.bg }}>
                    <h2
                      className="flex shrink-0 items-center gap-2 text-2xl font-extrabold sm:w-36 sm:flex-col sm:justify-center sm:text-center"
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
                          className={`relative flex w-36 shrink-0 flex-col items-center gap-1.5 rounded-[20px] border-2 bg-white p-2.5 text-center transition active:scale-[0.97] disabled:cursor-default sm:w-auto ${
                            t.checked ? 'lift border-violet' : 'border-line'
                          }`}
                        >
                          <TaskPicture icon={t.icon} className={`h-16 w-16 rounded-2xl transition ${t.checked ? 'opacity-55' : ''}`} />
                          <span className={`font-display text-lg font-bold leading-tight ${t.checked ? 'text-muted' : ''}`}>{t.title}</span>
                          {t.mandatory && (
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">Must do</span>
                          )}
                          {/* The stamp */}
                          <span className="stamp absolute right-1.5 top-1.5 h-9 w-9" data-on={t.checked}>
                            {t.checked && <Check size={18} strokeWidth={4} className="text-white" />}
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

/** The kid's rewards: what each needs today and whether it is earned. */
function RewardsDialog({
  kidName,
  dayText,
  rewards,
  done,
  total,
  mustDoLeft,
  isEarned,
  onClose,
}: {
  kidName: string;
  dayText: string;
  rewards: Reward[];
  done: number;
  total: number;
  mustDoLeft: number;
  isEarned: (r: Reward) => boolean;
  onClose: () => void;
}) {
  /** What's still missing for a reward, in plain words. */
  const missing = (r: Reward) => {
    if (r.min_score! > total) return `Needs ${r.min_score} tasks`;
    const more = r.min_score! - done;
    if (more > 0) return `${more} more`;
    return mustDoLeft > 0 ? `${mustDoLeft} must-do left` : '';
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal aria-label={`${kidName}'s rewards`} onClick={onClose}>
      <div className="panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold">
            <Gift className="text-sun" /> {kidName}'s rewards
          </h2>
          <button aria-label="Close" className="p-1 text-muted" onClick={onClose}>
            <X />
          </button>
        </div>
        <p className="mb-4 text-muted">
          {dayText}: {done} of {total} tasks done. Rewards start again every day.
        </p>
        {rewards.length === 0 ? (
          <p className="rounded-2xl bg-soft p-4 text-center text-lg text-muted">No rewards yet. Ask a parent to add one in Settings.</p>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const earned = isEarned(r);
              return (
                <li key={r.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${earned ? 'border-sun bg-sun-soft' : 'border-line'}`}>
                  <img src={rewardIconUrl(r.icon)} alt="" className={`h-12 w-12 shrink-0 ${earned ? '' : 'opacity-60 grayscale-[40%]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-extrabold">{r.title}</div>
                    <div className="text-muted">{rewardRule(r)}</div>
                  </div>
                  <span className={`shrink-0 text-right font-extrabold ${earned ? 'text-sun-ink' : 'text-muted'}`}>
                    {earned ? (
                      <span className="inline-flex items-center gap-1">
                        <Trophy size={18} /> {dayText.startsWith('Today') ? 'Earned today!' : 'Earned!'}
                      </span>
                    ) : (
                      missing(r)
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
