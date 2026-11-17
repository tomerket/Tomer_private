import { CalendarRange, Check, ChevronLeft, ClipboardList, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { CheckDropdown } from '../components/CheckDropdown';
import { PhotoSourceButton } from '../components/PhotoSourceButton';
import { TASK_ICONS, taskIconUrl } from '../lib/taskIcons';
import { useConfirm } from '../components/ConfirmDialog';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { resizeImage } from '../lib/image';
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
  photo_path: string | null;
  icon: string | null; // gallery picture
  photoUrl: string | null;
};
type Filter = 'today' | 'due' | 'open' | 'done';
type Patch = Partial<{ subject: string; description: string; done: boolean; day: string; dueDate: string; icon: string | null }>;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'Open today' },
  { key: 'due', label: 'Due today' },
  { key: 'open', label: 'All open' },
  { key: 'done', label: 'Done' },
];

const mdy = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const localDay = (ts: string) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Picture for a parents task: pick one from the gallery, or use the camera button to upload a
 * photo or take one with the phone camera.
 */
function PicturePicker({
  icon,
  photoPreview,
  disabled,
  onIcon,
  onPhoto,
  onClear,
}: {
  icon: string | null;
  photoPreview: string | null;
  disabled?: boolean;
  onIcon: (key: string) => void;
  onPhoto: (f: File) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = photoPreview ?? (icon ? taskIconUrl(icon) : null);
  return (
    <div>
      <span className="label">Picture</span>
      <div className="flex flex-wrap items-center gap-3">
        <PhotoSourceButton label="Upload or take a photo" onPick={onPhoto} disabled={disabled} />
        <button type="button" className="btn btn-ghost py-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide pictures' : 'Choose a picture'}
        </button>
        {chosen && (
          <span className="inline-flex items-center gap-2">
            <img src={chosen} alt="Chosen picture" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-violet" />
            <button type="button" className="rounded-lg p-2 text-muted hover:bg-white hover:text-danger" title="Remove picture" aria-label="Remove picture" onClick={onClear}>
              <Trash2 size={20} />
            </button>
          </span>
        )}
      </div>
      {open && (
        <div className="mt-2 grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-2xl bg-white p-2 sm:grid-cols-10">
          {TASK_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              title={i.label}
              aria-label={i.label}
              aria-pressed={icon === i.key}
              onClick={() => {
                onIcon(i.key);
                setOpen(false);
              }}
              className={`grid aspect-square place-items-center rounded-xl border-2 p-1 transition ${icon === i.key ? 'border-violet bg-violet-soft' : 'border-transparent hover:bg-soft'}`}
            >
              <img src={taskIconUrl(i.key) ?? ''} alt="" className="h-full w-full rounded-lg object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentsTasks() {
  const { me } = useSession();
  const [confirmDialog, confirm] = useConfirm();
  const canEdit = me?.member?.role === 'parent';
  const members = me?.members ?? [];
  const parents = members.filter((m) => m.role === 'parent');
  const nameOf = (id: string | null) => members.find((p) => p.id === id)?.name;
  const todayIso = today();

  const [filter, setFilter] = useState<Filter>('open'); // All open by default
  const [who, setWho] = useState<string[] | null>(null); // null = everyone
  const [tasks, setTasks] = useState<ParentTask[] | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  // Every task is given to a parent; start with the parent who is signed in
  const [assignee, setAssignee] = useState(me?.member?.role === 'parent' ? me.member.id : '');
  const [icon, setIcon] = useState<string | null>(null);
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = filter === 'today' ? `day=${todayIso}` : filter === 'done' ? 'filter=done' : 'filter=open';
      setTasks((await api<{ tasks: ParentTask[] }>(`/parent-tasks?${q}`)).tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter, todayIso]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => void (photoPreview && URL.revokeObjectURL(photoPreview)), [photoPreview]);

  async function pickNewPhoto(f: File) {
    try {
      const b = await resizeImage(f, 1600);
      setPhoto(b);
      setPhotoPreview(URL.createObjectURL(b));
    } catch {
      setError("Couldn't read that photo. Please try another one.");
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) return setError('Please write a subject');
    if (!start || !end) return setError('Please choose a start date and an end date');
    if (end < start) return setError('The end date can’t be before the start date');
    if (!assignee) return setError('Choose who the task is for');
    setBusy(true);
    try {
      const { task } = await api<{ task: ParentTask }>('/parent-tasks', {
        body: { subject, description, day: start, dueDate: end, assignedTo: assignee, icon },
      });
      if (photo) await api(`/parent-tasks/${task.id}/photo`, { raw: photo });
      setSubject('');
      setDescription('');
      setEnd('');
      setStart(todayIso);
      setPhoto(null);
      setPhotoPreview(null);
      setIcon(null);
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

  async function setTaskPhoto(id: string, f: File | null) {
    setError(null);
    try {
      const { task } = f
        ? await api<{ task: ParentTask }>(`/parent-tasks/${id}/photo`, { raw: await resizeImage(f, 1600) })
        : await api<{ task: ParentTask }>(`/parent-tasks/${id}/photo`, { method: 'DELETE' });
      setTasks((list) => list?.map((t) => (t.id === id ? task : t)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Delete this task?', confirmLabel: 'Yes, delete' }))) return;
    setError(null);
    try {
      await api(`/parent-tasks/${id}`, { method: 'DELETE' });
      setTasks((list) => list?.filter((t) => t.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const visible = (tasks ?? [])
    // Today: started and not done, plus anything finished today. Due today: open tasks that end today or earlier.
    .filter((t) => {
      if (filter === 'today') return !t.done || (t.done_at && localDay(t.done_at) === todayIso);
      if (filter === 'due') return !t.done && t.due_date <= todayIso;
      if (filter === 'done') return t.done; // reopening a task takes it off this list
      return !t.done; // All open: a task ticked done leaves the list
    })
    .filter((t) => who === null || (t.assigned_to !== null && who.includes(t.assigned_to)));
  const doneCount = visible.filter((t) => t.done).length;

  return (
    <AppLayout title="Parents Tasks" icon={<ClipboardList className="text-violet" />}>
      {confirmDialog}
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-xl font-bold text-violet hover:underline">
        <ChevronLeft size={24} /> Family Tasks
      </Link>

      <div className="mx-auto max-w-5xl text-xl">
        {canEdit && (
          <form onSubmit={add} className="mb-5 space-y-3 rounded-[28px] bg-soft p-4 sm:p-5">
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
            <PicturePicker
              icon={icon}
              photoPreview={photoPreview}
              disabled={busy}
              onIcon={(k) => {
                setIcon(k);
                setPhoto(null);
                setPhotoPreview(null);
              }}
              onPhoto={(f) => {
                setIcon(null);
                pickNewPhoto(f);
              }}
              onClear={() => {
                setIcon(null);
                setPhoto(null);
                setPhotoPreview(null);
              }}
            />
            <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
              <label>
                <span className="label">Start date *</span>
                <input type="date" required className="input !text-xl" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                <span className="label">End date *</span>
                <input type="date" required className="input !text-xl" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label>
                <span className="label">For *</span>
                <select className="input !text-xl" value={assignee} onChange={(e) => setAssignee(e.target.value)} required>
                  <option value="">Choose a parent…</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary px-8 py-4 !text-2xl" disabled={busy || !subject.trim() || !start || !end}>
                <Plus size={22} /> {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-2 gap-1 rounded-3xl bg-soft p-1 sm:grid-cols-4 sm:rounded-full">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-full px-5 py-2.5 text-lg font-bold transition ${filter === f.key ? 'bg-white text-violet shadow' : 'text-muted'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {parents.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-muted">For</span>
              <CheckDropdown
                ariaLabel="Show tasks for"
                className="w-56"
                allLabel="Everyone"
                options={parents.map((p) => ({ id: p.id, label: p.name }))}
                selected={who}
                onChange={setWho}
              />
            </div>
          )}
          {visible.length > 0 && filter === 'today' && (
            <span className="ml-auto text-xl font-bold text-muted">
              {doneCount}/{visible.length} done
            </span>
          )}
        </div>

        <ErrorBox message={error} />

        {!tasks ? (
          !error && <div className="py-10 text-center text-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-2xl text-muted">
            {filter === 'today'
              ? 'No tasks for today yet.'
              : filter === 'due'
                ? 'Nothing due today.'
                : filter === 'done'
                  ? 'No finished tasks yet. Tick a task to close it.'
                  : 'Nothing open. Nice work!'}
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
                onPhoto={(f) => setTaskPhoto(t.id, f)}
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
  onPhoto,
  onDelete,
}: {
  task: ParentTask;
  todayIso: string;
  canEdit: boolean;
  assigneeName?: string;
  creatorName?: string;
  onToggle: () => void;
  onSave: (p: Patch) => void;
  onPhoto: (f: File | null) => void;
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
    <li className={`flex items-start gap-4 rounded-[20px] border-2 p-4 transition ${task.done ? 'border-line bg-soft' : 'border-line bg-white'}`}>
      <button
        aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
        disabled={!canEdit}
        onClick={onToggle}
        className="stamp stamp-bold mt-1 h-12 w-12"
        data-on={task.done}
      >
        {task.done && <Check size={28} strokeWidth={5} className="text-white" />}
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
            <PicturePicker
              icon={task.icon}
              photoPreview={task.photoUrl}
              onIcon={(k) => {
                onSave({ icon: k });
                if (task.photoUrl) onPhoto(null);
              }}
              onPhoto={(f) => {
                onPhoto(f);
                if (task.icon) onSave({ icon: null });
              }}
              onClear={() => {
                if (task.photoUrl) onPhoto(null);
                if (task.icon) onSave({ icon: null });
              }}
            />
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
          <div className="flex gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`break-words text-2xl font-extrabold ${task.done ? 'text-muted line-through' : ''}`}>{task.subject}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-base font-bold ${st.cls}`}>{st.text}</span>
              </div>
              {task.text && <p className={`mt-1 whitespace-pre-wrap break-words text-lg ${task.done ? 'text-muted' : 'text-ink'}`}>{task.text}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-muted">
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <CalendarRange size={17} /> {mdy(task.day)} to {mdy(task.due_date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound size={17} /> For <b className="text-ink">{assigneeName ?? 'not given to anyone yet'}</b>
                </span>
                <span>
                  Added by {creatorName ?? 'someone'} on {mdy(localDay(task.created_at))}
                </span>
              </div>
            </div>
            {task.photoUrl ? (
              <a href={task.photoUrl} target="_blank" rel="noreferrer" title="Open photo" className="shrink-0">
                <img src={task.photoUrl} alt={`Photo for ${task.subject}`} className="h-20 w-20 rounded-2xl object-cover sm:h-24 sm:w-24" />
              </a>
            ) : (
              task.icon && <img src={taskIconUrl(task.icon) ?? ''} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24" />
            )}
          </div>
        )}
      </div>

      {canEdit && !editing && (
        <div className="flex shrink-0 gap-1">
          <button aria-label="Edit task" title="Edit task" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-violet" onClick={() => setEditing(true)}>
            <Pencil size={24} />
          </button>
          <button aria-label="Delete task" title="Delete task" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-danger" onClick={onDelete}>
            <Trash2 size={24} />
          </button>
        </div>
      )}
    </li>
  );
}
