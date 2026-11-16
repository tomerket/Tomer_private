import { CalendarClock, Check, ChevronLeft, ClipboardList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';

type ParentTask = {
  id: string;
  text: string;
  day: string; // start date
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
};
type Filter = 'today' | 'open';
type Patch = Partial<{ text: string; done: boolean; day: string; dueDate: string | null }>;

const mdy = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const localDay = (ts: string) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ParentsTasks() {
  const { me } = useSession();
  const canEdit = me?.member?.role === 'parent';
  const parents = (me?.members ?? []).filter((m) => m.role === 'parent');
  const nameOf = (id: string | null) => parents.find((p) => p.id === id)?.name;
  const todayIso = today();

  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState<ParentTask[] | null>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [start, setStart] = useState(todayIso);
  const [due, setDue] = useState('');
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
    if (!text.trim()) return;
    if (due && due < start) return setError('The due date can’t be before the start date');
    setBusy(true);
    setError(null);
    try {
      await api<{ task: ParentTask }>('/parent-tasks', { body: { text, day: start, dueDate: due || null, assignedTo: assignee || null } });
      setText('');
      setDue('');
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
          <form onSubmit={add} className="mb-5 rounded-2xl bg-soft p-4">
            <label className="label !text-2xl" htmlFor="new-task">
              Add a task
            </label>
            <textarea
              id="new-task"
              className="input min-h-[110px] resize-y !text-2xl"
              placeholder="e.g. Buy milk and bread, call the dentist, pay the electricity bill…"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
              <label>
                <span className="label">Start date</span>
                <input type="date" className="input !text-xl" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">Due date (optional)</span>
                <input type="date" className="input !text-xl" value={due} min={start} onChange={(e) => setDue(e.target.value)} />
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
              <button className="btn btn-primary px-8 py-4 !text-2xl" disabled={busy || !text.trim()}>
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

function DateChips({ task, todayIso }: { task: ParentTask; todayIso: string }) {
  const chips: { text: string; cls: string }[] = [];
  if (task.day > todayIso) chips.push({ text: `Starts ${mdy(task.day)}`, cls: 'bg-soft text-muted' });
  if (task.due_date) {
    if (!task.done && task.due_date < todayIso) chips.push({ text: `Overdue · was due ${mdy(task.due_date)}`, cls: 'bg-danger/10 text-danger' });
    else if (!task.done && task.due_date === todayIso) chips.push({ text: 'Due today', cls: 'bg-amber-100 text-amber-800' });
    else chips.push({ text: `Due ${mdy(task.due_date)}`, cls: 'bg-soft text-ink' });
  }
  return (
    <>
      {chips.map((c) => (
        <span key={c.text} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${c.cls}`}>
          <CalendarClock size={16} /> {c.text}
        </span>
      ))}
    </>
  );
}

function TaskItem({
  task,
  todayIso,
  canEdit,
  assigneeName,
  onToggle,
  onSave,
  onDelete,
}: {
  task: ParentTask;
  todayIso: string;
  canEdit: boolean;
  assigneeName?: string;
  onToggle: () => void;
  onSave: (p: Patch) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [start, setStart] = useState(task.day);
  const [due, setDue] = useState(task.due_date ?? '');

  function cancel() {
    setDraft(task.text);
    setStart(task.day);
    setDue(task.due_date ?? '');
    setEditing(false);
  }

  return (
    <li className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition ${task.done ? 'border-line bg-soft' : 'border-violet-soft bg-white'}`}>
      <button
        aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        disabled={!canEdit}
        onClick={onToggle}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] transition ${task.done ? 'border-violet bg-violet' : 'border-violet bg-white'}`}
      >
        {task.done && <Check size={28} strokeWidth={4} className="text-white" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-3">
            <textarea className="input min-h-[90px] !text-2xl" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex flex-wrap gap-3">
              <label>
                <span className="label">Start date</span>
                <input type="date" className="input !text-lg" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">Due date</span>
                <input type="date" className="input !text-lg" value={due} min={start} onChange={(e) => setDue(e.target.value)} />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary py-2"
                disabled={!draft.trim() || (Boolean(due) && due < start)}
                onClick={() => {
                  onSave({ text: draft, day: start, dueDate: due || null });
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
            <p className={`whitespace-pre-wrap break-words text-2xl font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.text}</p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-base">
              {assigneeName && <span className="rounded-full bg-violet-soft px-2.5 py-0.5 font-bold text-violet">{assigneeName}</span>}
              <DateChips task={task} todayIso={todayIso} />
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
