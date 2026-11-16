import { Check, ChevronLeft, Smile } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';

type Task = { id: number; title: string; icon: string; sort_order: number; checked: boolean };

// Tile accent colors, cycling like the chore-chart references
const COLORS = ['#3B82F6', '#22C55E', '#A855F7', '#F97316', '#EF4444', '#EC4899', '#14B8A6', '#EAB308'];

export default function KidsTasks() {
  const { me } = useSession();
  const isKid = me?.member?.role === 'kid';
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
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 font-bold text-violet hover:underline">
        <ChevronLeft size={20} /> Family Tasks
      </Link>

      {kids.length === 0 ? (
        <p className="py-10 text-center text-lg text-muted">There are no kids in this family yet.</p>
      ) : (
        <>
          {kids.length > 1 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {kids.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKidId(k.id)}
                  className={`rounded-full px-5 py-2 text-lg font-bold transition ${
                    k.id === kidId ? 'bg-violet text-white shadow' : 'bg-soft text-ink hover:bg-violet-soft'
                  }`}
                >
                  {k.name}
                </button>
              ))}
            </div>
          )}

          <div className="mb-6 rounded-2xl bg-soft p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold">
                {allDone ? `Amazing, ${kidName}! All done! 🎉` : `${kidName}'s tasks for today`}
              </span>
              <span className="text-2xl font-extrabold text-violet">
                {done}/{total}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-all duration-500"
                style={{ width: total ? `${(done / total) * 100}%` : 0 }}
              />
            </div>
          </div>

          <ErrorBox message={error} />

          {!tasks ? (
            !error && <div className="py-10 text-center text-muted">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {tasks.map((t, i) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(t)}
                    aria-pressed={t.checked}
                    className="relative flex flex-col items-center rounded-2xl border-[3px] bg-white p-3 pt-4 text-center transition active:scale-95"
                    style={{ borderColor: color, background: t.checked ? `${color}14` : '#fff' }}
                  >
                    <span
                      className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full text-sm font-extrabold text-white"
                      style={{ background: color }}
                    >
                      {i + 1}
                    </span>
                    <span className={`text-5xl transition ${t.checked ? 'scale-90 opacity-60' : ''}`}>{t.icon}</span>
                    <span className="mt-2 min-h-[2.5em] text-lg font-bold leading-tight">{t.title}</span>
                    <span
                      className="mt-2 grid h-9 w-9 place-items-center rounded-lg border-[3px] transition"
                      style={{ borderColor: color, background: t.checked ? color : '#fff' }}
                    >
                      {t.checked && <Check size={22} strokeWidth={4} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
