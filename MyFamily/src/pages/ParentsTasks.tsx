import { CalendarRange, Check, ChevronLeft, ClipboardList, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';

type ParentTask = {
  id: string;
  subject: string;
  text: string | null; // description
  day: string; // start date
  due_date: string; // end date
  done: boolean;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
};
type Filter = 'today' | 'open';
type Patch = Partial<{ subject: string; description: string; done: boolean; day: string; dueDate: string }>;

const mdy = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const localDay = (ts: string) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ParentsTasks() {
  const { me } = useSession();
  const canEdit = me?.member?.role === 'parent';
  const members = me?.members ?? [];
  const parents = members.filter((m) => m.role === 'parent');
  const nameOf = (id: string | null) => members.find((p) => p.id === id)?.name;
  const todayIso = today();

  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState<ParentTask[] | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = filter === 'open' ? 'filter=open' : `day=${todayIso}`;
      setTasks((await api<{ tasks: ParentTask[] }>(`/parent-tasks?${q}`)).tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter, todayIso]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) return setError('Please write a subject');
    if (!start || !end) return setError('Please choose a start date and an end date');
    if (end < start) return setError('The end date can’t be before the start date');
    setBusy(true);
    try {
      await api('/parent-tasks', { body: { subject, description, day: start, dueDate: end, assignedTo: assignee || null } });
      setSubject('');
      setDescription('');
      setEnd('');
      setStart(todayIso);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Patch) {
    setError(null);
    try {
      const { task } = await api<{ task: ParentTask }>(`/parent-tasks/${id}`, { method: 'PATCH', body });
      setTasks((list) => list?.map((t) => (t.id === id ? task : t)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this task?')) return;
    setError(null);
    try {
      await api(`/parent-tasks/${id}`, { method: 'DELETE' });
      setTasks((list) => list?.filter((t) => t.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Today: started and not done, plus anything finished today (in this browser's time zone)
  const visible = (tasks ?? []).filter((t) => filter === 'open' || !t.done || (t.done_at && localDay(t.done_at) === todayIso));
  const doneCount = visible.filter((t) => t.done).length;

  return (
    <AppLayout title="Parents Tasks" icon={<ClipboardList className="text-violet" />}>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-xl font-bold text-violet hover:underline">
        <ChevronLeft size={24} /> Family Tasks
      </Link>

      <div className="mx-auto max-w-5xl text-xl">
        {canEdit && (
          <form onSubmit={add} className="mb-5 space-y-3 rounded-2xl bg-soft p-4">
            <div className="text-2xl font-extrabold">New task</div>
            <label className="block">
              <span className="label">Subject *</span>
              <input className="input !text-2xl" placeholder="e.g. Pay the electricity bill" maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Task description</span>
              <textarea
                className="input min-h-[90px] resize-y !text-xl"
                placeholder="Details, notes, phone numbers…"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
              <label>
                <span className="label">Start date *</span>
                <input type="date" required className="input !text-xl" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">End date *</span>
                <input type="date" required className="input !text-xl" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
              {parents.length > 1 ? (
                <label>
                  <span className="label">For</span>
                  <select className="input !text-xl" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Anyone</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
              <button className="btn btn-primary px-8 py-4 !text-2xl" disabled={busy || !subject.trim() || !start || !end}>
                <Plus size={22} /> Add
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-soft p-1">
            {(['today', 'open'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-6 py-3 text-xl font-bold transition ${filter === f ? 'bg-white text-violet shadow' : 'text-muted'}`}
              >
                {f === 'today' ? 'Today' : 'All open'}
              </button>
            ))}
          </div>
          {visible.length > 0 && filter === 'today' && (
            <span className="text-xl font-bold text-muted">
              {doneCount}/{visible.length} done
            </span>
          )}
        </div>

        <ErrorBox message={error} />

        {!tasks ? (
          !error && <div className="py-10 text-center text-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-2xl text-muted">
            {filter === 'today' ? 'No tasks for today yet.' : 'Nothing open. Nice work!'}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                todayIso={todayIso}
                canEdit={canEdit}
                assigneeName={nameOf(t.assigned_to)}
                creatorName={nameOf(t.created_by)}
                onToggle={() => patch(t.id, { done: !t.done })}
                onSave={(p) => patch(t.id, p)}
                onDelete={() => remove(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

/** Status of a task relative to today. */
function status(task: ParentTask, todayIso: string): { text: string; cls: string } {
  if (task.done) return { text: task.done_at ? `Done ${mdy(localDay(task.done_at))}` : 'Done', cls: 'bg-success/10 text-success' };
  if (task.day > todayIso) return { text: 'Not started yet', cls: 'bg-soft text-muted' };
  if (task.due_date < todayIso) return { text: 'Overdue', cls: 'bg-danger/10 text-danger' };
  if (task.due_date === todayIso) return { text: 'Ends today', cls: 'bg-sun-soft text-sun-ink' };
  return { text: 'In progress', cls: 'bg-violet-soft text-violet' };
}

function TaskItem({
  task,
  todayIso,
  canEdit,
  assigneeName,
  creatorName,
  onToggle,
  onSave,
  onDelete,
}: {
  task: ParentTask;
  todayIso: string;
  canEdit: boolean;
  assigneeName?: string;
  creatorName?: string;
  onToggle: () => void;
  onSave: (p: Patch) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(task.subject);
  const [description, setDescription] = useState(task.text ?? '');
  const [start, setStart] = useState(task.day);
  const [end, setEnd] = useState(task.due_date);
  const st = status(task, todayIso);

  function cancel() {
    setSubject(task.subject);
    setDescription(task.text ?? '');
    setStart(task.day);
    setEnd(task.due_date);
    setEditing(false);
  }

  return (
    <li className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition ${task.done ? 'border-line bg-soft' : 'border-violet-soft bg-white'}`}>
      <button
        aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        disabled={!canEdit}
        onClick={onToggle}
        className={`mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] transition ${task.done ? 'border-violet bg-violet' : 'border-violet bg-white'}`}
      >
        {task.done && <Check size={28} strokeWidth={4} className="text-white" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-3">
            <label>
              <span className="label">Subject *</span>
              <input className="input !text-xl" maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
            </label>
            <label>
              <span className="label">Task description</span>
              <textarea className="input min-h-[80px] !text-lg" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-3">
              <label>
                <span className="label">Start date *</span>
                <input type="date" className="input !text-lg" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">End date *</span>
                <input type="date" className="input !text-lg" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary py-2"
                disabled={!subject.trim() || !start || !end || end < start}
                onClick={() => {
                  onSave({ subject, description, day: start, dueDate: end });
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button className="btn btn-ghost py-2" onClick={cancel}>
                <X size={18} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`break-words text-2xl font-extrabold ${task.done ? 'text-muted line-through' : ''}`}>{task.subject}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-base font-bold ${st.cls}`}>{st.text}</span>
            </div>
            {task.text && <p className={`mt-1 whitespace-pre-wrap break-words text-lg ${task.done ? 'text-muted' : 'text-ink'}`}>{task.text}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-muted">
              <span className="inline-flex items-center gap-1 font-semibold text-ink">
                <CalendarRange size={17} /> {mdy(task.day)} → {mdy(task.due_date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound size={17} /> For: <b className="text-ink">{assigneeName ?? 'Anyone'}</b>
              </span>
              <span>
                Added by {creatorName ?? 'someone'} on {mdy(localDay(task.created_at))}
              </span>
            </div>
          </>
        )}
      </div>

      {canEdit && !editing && (
        <div className="flex shrink-0 gap-1">
          <button aria-label="Edit task" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-violet" onClick={() => setEditing(true)}>
            <Pencil size={24} />
          </button>
          <button aria-label="Delete task" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-danger" onClick={onDelete}>
            <Trash2 size={24} />
          </button>
        </div>
      )}
    </li>
  );
}
