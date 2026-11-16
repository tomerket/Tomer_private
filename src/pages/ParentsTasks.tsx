import { Check, ChevronLeft, ClipboardList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';

type ParentTask = {
  id: string;
  text: string;
  day: string;
  done: boolean;
  assigned_to: string | null;
  created_by: string | null;
};
type Filter = 'today' | 'open';

export default function ParentsTasks() {
  const { me } = useSession();
  const canEdit = me?.member?.role === 'parent';
  const parents = (me?.members ?? []).filter((m) => m.role === 'parent');
  const nameOf = (id: string | null) => parents.find((p) => p.id === id)?.name;

  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState<ParentTask[] | null>(null);
  const [text, setText] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const day = today();

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = filter === 'open' ? 'filter=open' : `day=${day}`;
      setTasks((await api<{ tasks: ParentTask[] }>(`/parent-tasks?${q}`)).tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter, day]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { task } = await api<{ task: ParentTask }>('/parent-tasks', {
        body: { text, day, assignedTo: assignee || null },
      });
      setTasks((list) => [...(list ?? []), task]);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Partial<{ text: string; done: boolean }>) {
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

  const doneCount = tasks?.filter((t) => t.done).length ?? 0;

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
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {parents.length > 1 && (
                <select className="input !text-xl sm:w-64" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Anyone</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      For {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn btn-primary px-8 py-4 !text-2xl sm:ml-auto" disabled={busy || !text.trim()}>
                <Plus size={20} /> Add
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
          {tasks && tasks.length > 0 && (
            <span className="text-xl font-bold text-muted">
              {doneCount}/{tasks.length} done
            </span>
          )}
        </div>

        <ErrorBox message={error} />

        {!tasks ? (
          !error && <div className="py-10 text-center text-muted">Loading…</div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-2xl text-muted">
            {filter === 'today' ? 'No tasks for today yet.' : 'Nothing open. Nice work!'}
          </div>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                canEdit={canEdit}
                assigneeName={nameOf(t.assigned_to)}
                showDay={filter === 'open' && t.day !== day}
                onToggle={() => patch(t.id, { done: !t.done })}
                onSave={(text) => patch(t.id, { text })}
                onDelete={() => remove(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function TaskItem({
  task,
  canEdit,
  assigneeName,
  showDay,
  onToggle,
  onSave,
  onDelete,
}: {
  task: ParentTask;
  canEdit: boolean;
  assigneeName?: string;
  showDay: boolean;
  onToggle: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [mm, dd, yyyy] = [task.day.slice(5, 7), task.day.slice(8, 10), task.day.slice(0, 4)];

  return (
    <li className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition ${task.done ? 'border-line bg-soft' : 'border-violet-soft bg-white'}`}>
      <button
        aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        disabled={!canEdit}
        onClick={onToggle}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] transition ${
          task.done ? 'border-violet bg-violet' : 'border-violet bg-white'
        }`}
      >
        {task.done && <Check size={28} strokeWidth={4} className="text-white" />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea className="input min-h-[90px] !text-2xl" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button
                className="btn btn-primary py-2"
                disabled={!draft.trim()}
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="btn btn-ghost py-2"
                onClick={() => {
                  setDraft(task.text);
                  setEditing(false);
                }}
              >
                <X size={18} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={`whitespace-pre-wrap break-words text-2xl font-semibold ${task.done ? 'text-muted line-through' : ''}`}>{task.text}</p>
            {(assigneeName || showDay) && (
              <div className="mt-1 flex flex-wrap gap-2 text-base">
                {assigneeName && <span className="rounded-full bg-violet-soft px-2 py-0.5 font-bold text-violet">{assigneeName}</span>}
                {showDay && <span className="text-muted">{`${mm}-${dd}-${yyyy}`}</span>}
              </div>
            )}
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
