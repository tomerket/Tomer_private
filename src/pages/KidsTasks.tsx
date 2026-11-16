import { Check, ChevronLeft, Smile } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useRoles, useSession } from '../lib/session';
import { PERIODS, taskIconUrl, type Period } from '../lib/taskIcons';

type Task = { id: number; title: string; icon: string; period: Period; sort_order: number; checked: boolean };

/** Section look: background, heading color and tile accent. */
const SECTION_STYLE: Record<Period, { bg: string; heading: string; accent: string }> = {
  morning: { bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', heading: '#92400E', accent: '#F59E0B' },
  general: { bg: 'linear-gradient(135deg, #E0F2FE 0%, #CCFBF1 100%)', heading: '#075985', accent: '#0EA5E9' },
  evening: { bg: 'linear-gradient(135deg, #312E81 0%, #1E1B4B 100%)', heading: '#FFFFFF', accent: '#8B5CF6' },
};

export function TaskPicture({ icon, className }: { icon: string; className?: string }) {
  const url = taskIconUrl(icon);
  return url ? <img src={url} alt="" className={className} draggable={false} /> : <span className="text-6xl">{icon}</span>;
}

export default function KidsTasks() {
  const { me } = useSession();
  const { isKid } = useRoles();
  // Kids only ever see themselves; parents see every kid
  const kids = (me?.members ?? []).filter((m) => m.role === 'kid' && (!isKid || m.id === me?.member?.id));
  const [kidId, setKidId] = useState<string | null>(kids[0]?.id ?? null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = today();

  const load = useCallback(async () => {
    if (!kidId) return;
    setTasks(null);
    setError(null);
    try {
      const r = await api<{ tasks: Task[] }>(`/kids/${kidId}/tasks?day=${day}`);
      setTasks(r.tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kidId, day]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: Task) {
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

  return (
    <AppLayout title="Kids Tasks" icon={<Smile className="text-violet" />}>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-lg font-bold text-violet hover:underline">
        <ChevronLeft size={22} /> Family Tasks
      </Link>

      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">There are no kids in this family yet.</p>
      ) : (
        <>
          {kids.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {kids.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKidId(k.id)}
                  className={`rounded-full px-6 py-2.5 text-xl font-bold transition ${
                    k.id === kidId ? 'bg-violet text-white shadow' : 'bg-soft text-ink hover:bg-violet-soft'
                  }`}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}

          {/* Progress row */}
          <div className={`mb-6 rounded-2xl p-5 sm:p-6 ${allDone ? 'hero-gradient text-white' : 'bg-soft'}`}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-2xl font-extrabold sm:text-3xl">
                {allDone ? `Amazing, ${kidName}! All done! 🎉` : `${kidName}'s tasks for today`}
              </span>
              <span className={`shrink-0 text-3xl font-extrabold sm:text-4xl ${allDone ? '' : 'text-violet'}`}>
                {done}/{total}
              </span>
            </div>
            <div className={`mt-3 h-5 overflow-hidden rounded-full ${allDone ? 'bg-white/30' : 'bg-white'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-white' : 'bg-gradient-to-r from-cyan to-violet'}`}
                style={{ width: total ? `${(done / total) * 100}%` : 0 }}
              />
            </div>
          </div>

          <ErrorBox message={error} />

          {!tasks ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : (
            <div className="space-y-6">
              {PERIODS.map((p) => {
                const list = tasks.filter((t) => t.period === p.key);
                if (list.length === 0) return null;
                const s = SECTION_STYLE[p.key];
                const sDone = list.filter((t) => t.checked).length;
                return (
                  <section key={p.key} className="rounded-3xl p-4 sm:p-6" style={{ background: s.bg }}>
                    <h2 className="mb-4 flex items-center gap-3 text-3xl font-extrabold uppercase tracking-wide" style={{ color: s.heading }}>
                      <TaskPicture icon={p.icon} className="h-10 w-10" />
                      {p.label}
                      <span className="ml-auto text-2xl">
                        {sDone}/{list.length}
                      </span>
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                      {list.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => toggle(t)}
                          aria-pressed={t.checked}
                          className="flex flex-col items-center rounded-2xl border-4 bg-white p-3 text-center shadow-sm transition active:scale-95 sm:p-4"
                          style={{ borderColor: t.checked ? s.accent : 'transparent' }}
                        >
                          <TaskPicture icon={t.icon} className={`h-20 w-20 transition sm:h-24 sm:w-24 ${t.checked ? 'opacity-50' : ''}`} />
                          <span className="mt-2 min-h-[2.6em] text-xl font-bold leading-tight sm:text-2xl">{t.title}</span>
                          <span
                            className="mt-3 grid h-11 w-11 place-items-center rounded-xl border-4 transition"
                            style={{ borderColor: s.accent, background: t.checked ? s.accent : '#fff' }}
                          >
                            {t.checked && <Check size={28} strokeWidth={4} className="text-white" />}
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
