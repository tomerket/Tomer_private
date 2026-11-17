import { Camera, Check, ImageOff, Pencil, Plus, Settings as SettingsIcon, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { BirthdayInput, isValidBirthday } from '../components/BirthdayInput';
import { Avatar, FacePicker } from '../components/Face';
import { ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { squareImage } from '../lib/image';
import { REWARD_ICONS, rewardIconUrl, rewardRule, type RewardKind } from '../lib/rewardIcons';
import { CheckDropdown } from '../components/CheckDropdown';
import { PhotoSourceButton } from '../components/PhotoSourceButton';
import { useConfirm } from '../components/ConfirmDialog';
import { useSession, type MemberSummary } from '../lib/session';
import { PERIODS, TASK_ICONS, type Period } from '../lib/taskIcons';
import { TaskPicture } from './KidsTasks';
import { Field } from './Login';

type Tab = 'members' | 'tasks' | 'rewards';
const TAB_LABEL: Record<Tab, string> = { members: 'Family members', tasks: 'Kids tasks', rewards: 'Rewards' };

export default function Settings() {
  const [tab, setTab] = useState<Tab>('members');
  return (
    <AppLayout title="Settings" icon={<SettingsIcon className="text-violet" />}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-soft p-1 sm:w-[32rem]">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2.5 text-lg font-bold transition ${tab === t ? 'bg-white text-violet shadow' : 'text-muted'}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {tab === 'members' ? <MembersSettings /> : tab === 'tasks' ? <TasksSettings /> : <RewardsSettings />}
      </div>
    </AppLayout>
  );
}

// ---------------- Kid picker (All kids / some kids) ----------------

/** value null = all kids */
function KidPicker({ value, onChange }: { value: string[] | null; onChange: (v: string[] | null) => void }) {
  const { me } = useSession();
  const kids = (me?.members ?? []).filter((m) => m.role === 'kid');
  const toggle = (id: string) => {
    const cur = value ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange(next.length === 0 || next.length === kids.length ? null : next);
  };
  const chip = (active: boolean) =>
    `rounded-full border-2 px-4 py-1.5 font-bold transition ${active ? 'border-violet bg-violet-soft text-violet' : 'border-line bg-white text-muted'}`;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
        All kids
      </button>
      {kids.map((k) => (
        <button key={k.id} type="button" className={chip(value !== null && value.includes(k.id))} onClick={() => toggle(k.id)}>
          {k.name}
        </button>
      ))}
    </div>
  );
}

function kidNames(ids: string[] | null, members: MemberSummary[]) {
  if (!ids) return 'All kids';
  const names = members.filter((m) => ids.includes(m.id)).map((m) => m.name);
  return names.length ? names.join(', ') : 'No kids';
}

// ---------------- Family members ----------------

function fmtBirthday(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}-${d}-${y}`;
}

function MembersSettings() {
  const { me, refresh } = useSession();
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [faceFor, setFaceFor] = useState<MemberSummary | null>(null);
  const [confirmFaceDialog, confirmFace] = useConfirm();

  async function remove(m: MemberSummary) {
    setError(null);
    try {
      await api(`/settings/members/${m.id}`, { method: 'DELETE' });
      setConfirmId(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeFace(m: MemberSummary) {
    if (!(await confirmFace({ title: `Remove ${m.name}'s face photo?` }))) return;
    setError(null);
    try {
      await api(`/settings/members/${m.id}/photo`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      {confirmFaceDialog}
      {faceFor && (
        <FacePicker
          name={faceFor.name}
          onCancel={() => setFaceFor(null)}
          onSave={async (face) => {
            await api(`/settings/members/${faceFor.id}/photo`, { raw: face });
            await refresh();
            setFaceFor(null);
          }}
        />
      )}
      <ul className="space-y-2">
        {me?.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line p-3">
            <Avatar name={m.name} photoUrl={m.photoUrl} role={m.role} size={56} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold">
                {m.name}
                {m.is_admin && <span className="ml-2 rounded-full bg-violet-soft px-2 py-0.5 text-xs font-bold text-violet">Admin</span>}
              </div>
              <div className="text-muted">
                <span className="capitalize">{m.role}</span>, born {fmtBirthday(m.birthday)}, age {m.age}
              </div>
            </div>
            <button
              className="btn btn-ghost px-3 py-2"
              onClick={() => setFaceFor(m)}
              title={m.photoUrl ? 'Change face photo' : 'Add face photo'}
              aria-label={`${m.photoUrl ? 'Change' : 'Add'} ${m.name}'s face photo`}
            >
              <Camera size={20} />
            </button>
            {m.photoUrl && (
              <button className="btn btn-ghost px-3 py-2 text-muted" title="Remove face photo" aria-label={`Remove ${m.name}'s face photo`} onClick={() => removeFace(m)}>
                <ImageOff size={18} />
              </button>
            )}
            {!m.is_admin &&
              (confirmId === m.id ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-danger">Remove {m.name}?</span>
                  <button className="btn bg-danger py-2 text-white" onClick={() => remove(m)}>
                    Remove
                  </button>
                  <button className="btn btn-ghost py-2" onClick={() => setConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn btn-ghost py-2 text-danger" onClick={() => setConfirmId(m.id)}>
                  <UserMinus size={18} /> Remove
                </button>
              ))}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Removing a family member also deletes their task history.</p>

      {adding ? (
        <AddMemberForm onDone={() => setAdding(false)} />
      ) : (
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <UserPlus size={20} /> Add family member
        </button>
      )}
    </div>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'kid' | 'parent'>('kid');
  const [birthday, setBirthday] = useState('');
  const [face, setFace] = useState<Blob | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Please enter a name');
    if (!isValidBirthday(birthday)) return setError('Please enter the birthday as MM-DD-YYYY');
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>('/settings/members', { body: { name, role, birthday } });
      if (face) await api(`/settings/members/${id}/photo`, { raw: face });
      await refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-soft p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-violet">New family member</span>
        <button type="button" aria-label="Close" className="p-1 text-muted" onClick={onDone}>
          <X />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Birthday">
          <BirthdayInput value={birthday} onChange={setBirthday} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['kid', 'parent'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-xl border-2 bg-white py-2 font-bold capitalize transition ${
              role === r ? 'border-violet bg-violet-soft text-violet' : 'border-line text-muted'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {facePreview ? (
          <img src={facePreview} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <Avatar name={name || '?'} role={role} size={56} />
        )}
        <button type="button" className="btn btn-ghost bg-white py-2" onClick={() => setPicking(true)}>
          <Camera size={18} /> {face ? 'Change face photo' : 'Add face photo (optional)'}
        </button>
      </div>
      {picking && (
        <FacePicker
          name={name || 'new member'}
          onCancel={() => setPicking(false)}
          onSave={(blob) => {
            setFace(blob);
            setFacePreview(URL.createObjectURL(blob));
            setPicking(false);
          }}
        />
      )}
      <ErrorBox message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Adding…' : 'Add'}
      </button>
    </form>
  );
}

// ---------------- Kids tasks ----------------

/** "Must do task" checkbox: ✓ when the task is a must-do task. */
function MustDoBox({ checked, onChange, compact = false }: { checked: boolean; onChange: (on: boolean) => void; compact?: boolean }) {
  return (
    <label className={`relative inline-flex cursor-pointer select-none items-center gap-2 font-bold ${compact ? 'text-sm' : ''}`} title="Must do task">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={`grid shrink-0 place-items-center rounded-md border-2 transition peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-violet ${
          compact ? 'h-6 w-6' : 'h-7 w-7'
        } ${checked ? 'border-danger bg-danger' : 'border-line bg-white'}`}
      >
        {checked && <Check size={compact ? 16 : 18} strokeWidth={4} className="text-white" />}
      </span>
      Must do{compact ? '' : ' task'}
    </label>
  );
}

type Template = { id: number; title: string; icon: string; period: Period; sort_order: number; member_ids: string[] | null; mandatory: boolean };

function TasksSettings() {
  const { me } = useSession();
  const [tasks, setTasks] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [editKidsId, setEditKidsId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks((await api<{ tasks: Template[] }>('/settings/kid-tasks')).tasks);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function setKids(id: number, memberIds: string[] | null) {
    setError(null);
    try {
      const { task } = await api<{ task: Template }>(`/settings/kid-tasks/${id}`, { method: 'PATCH', body: { memberIds: memberIds ?? 'all' } });
      setTasks((l) => l?.map((t) => (t.id === id ? task : t)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await api(`/settings/kid-tasks/${id}`, { method: 'DELETE' });
      setTasks((l) => l?.filter((t) => t.id !== id) ?? null);
      setConfirmId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function setMustDo(id: number, on: boolean) {
    setError(null);
    setTasks((l) => l?.map((t) => (t.id === id ? { ...t, mandatory: on } : t)) ?? null);
    try {
      await api(`/settings/kid-tasks/${id}`, { method: 'PATCH', body: { mandatory: on } });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  async function saveMandatory(ids: string[] | null) {
    if (!tasks) return;
    const chosen = ids === null ? tasks.map((t) => t.id) : ids.map(Number);
    setError(null);
    setTasks((l) => l?.map((t) => ({ ...t, mandatory: chosen.includes(t.id) })) ?? null);
    try {
      await api('/settings/kid-tasks/mandatory', { method: 'PUT', body: { taskIds: chosen } });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  const mandatoryIds = tasks?.filter((t) => t.mandatory).map((t) => String(t.id)) ?? [];

  return (
    <div className="space-y-6">
      <AddTaskForm onAdded={(t) => setTasks((l) => [...(l ?? []), t])} />
      {tasks && tasks.length > 0 && (
        <div className="rounded-2xl border-2 border-line p-4">
          <div className="text-lg font-extrabold">Must-do tasks</div>
          <p className="mb-2 text-muted">Tick every task the kids must do. Daily rewards are only earned when all of them are done.</p>
          <CheckDropdown
            ariaLabel="Must-do tasks"
            className="max-w-md"
            allLabel="All tasks"
            options={tasks.map((t) => ({ id: String(t.id), label: t.title, icon: <TaskPicture icon={t.icon} className="h-7 w-7 rounded-md" /> }))}
            selected={mandatoryIds.length === tasks.length ? null : mandatoryIds}
            onChange={saveMandatory}
          />
        </div>
      )}
      <ErrorBox message={error} />
      {!tasks ? (
        <div className="py-6 text-center text-muted">Loading…</div>
      ) : (
        PERIODS.map((p) => {
          const list = tasks.filter((t) => t.period === p.key);
          return (
            <section key={p.key}>
              <h3 className="mb-2 flex items-center gap-2 text-xl font-extrabold">
                <TaskPicture icon={p.icon} className="h-7 w-7" /> {p.label}
                <span className="text-base font-bold text-muted">({list.length})</span>
              </h3>
              {list.length === 0 ? (
                <p className="text-muted">No tasks here yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {list.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line p-2 pr-3">
                      <TaskPicture icon={t.icon} className="h-12 w-12 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold">
                          {t.title}
                          {t.mandatory && <span className="ml-2 rounded-full bg-danger px-2 py-0.5 align-middle text-xs font-bold text-white">Must do</span>}
                        </div>
                        <button className="text-sm font-semibold text-violet hover:underline" onClick={() => setEditKidsId(editKidsId === t.id ? null : t.id)}>
                          For: {kidNames(t.member_ids, me?.members ?? [])} ✎
                        </button>
                      </div>
                      <MustDoBox checked={t.mandatory} onChange={(on) => setMustDo(t.id, on)} compact />
                      {editKidsId === t.id && (
                        <div className="w-full">
                          <KidPicker value={t.member_ids} onChange={(ids) => setKids(t.id, ids)} />
                        </div>
                      )}
                      {confirmId === t.id ? (
                        <>
                          <button className="btn bg-danger px-3 py-1.5 text-white" onClick={() => remove(t.id)}>
                            Remove
                          </button>
                          <button className="btn btn-ghost px-3 py-1.5" onClick={() => setConfirmId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button aria-label={`Remove ${t.title}`} className="rounded-lg p-2 text-muted hover:bg-soft hover:text-danger" onClick={() => setConfirmId(t.id)}>
                          <Trash2 size={20} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
      <p className="text-sm text-muted">Removed tasks disappear from today on. Past results stay in the Dashboard.</p>
    </div>
  );
}

function AddTaskForm({ onAdded }: { onAdded: (t: Template) => void }) {
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<Period>('general');
  const [icon, setIcon] = useState('star');
  const [kids, setKids] = useState<string[] | null>(null);
  const [mandatory, setMandatory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  /** Upload a photo from the device, cropped to a square, and select it as the picture. */
  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await api<{ url: string }>('/settings/task-image', { raw: await squareImage(file) });
      setIcon(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Please enter the task name');
    setBusy(true);
    try {
      const { task } = await api<{ task: Template }>('/settings/kid-tasks', { body: { title, period, icon, mandatory, memberIds: kids ?? 'all' } });
      onAdded(task);
      setTitle('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-soft p-4 sm:p-5">
      <div className="text-lg font-extrabold text-violet">Add a kids task</div>
      <Field label="Task name">
        <input className="input" placeholder="e.g. Practice piano" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div>
        <span className="label">When</span>
        <div className="grid grid-cols-3 gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 bg-white py-2 font-bold transition ${
                period === p.key ? 'border-violet bg-violet-soft text-violet' : 'border-line text-muted'
              }`}
            >
              <TaskPicture icon={p.icon} className="h-6 w-6" />
              <span className="hidden sm:inline">{p.label}</span>
              <span className="sm:hidden">{p.key === 'general' ? 'Day' : p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">For which kids</span>
        <KidPicker value={kids} onChange={setKids} />
      </div>
      <MustDoBox checked={mandatory} onChange={setMandatory} />
      <div>
        <span className="label">Picture</span>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <PhotoSourceButton label="Your own photo" disabled={uploading} onPick={(f) => uploadPhoto(f)} />
          <span className="text-muted">{uploading ? 'Uploading…' : 'Your own photo, or pick one below'}</span>
          {icon.startsWith('https://') && (
            <span className="inline-flex items-center gap-2 font-semibold text-violet">
              <TaskPicture icon={icon} className="h-12 w-12 rounded-xl ring-2 ring-violet" /> Your photo is selected
            </span>
          )}
        </div>
        <div className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-2xl bg-white p-2 sm:grid-cols-10">
          {TASK_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              title={i.label}
              aria-label={i.label}
              aria-pressed={icon === i.key}
              onClick={() => setIcon(i.key)}
              className={`grid aspect-square place-items-center rounded-xl border-2 p-1 transition ${
                icon === i.key ? 'border-violet bg-violet-soft' : 'border-transparent hover:bg-soft'
              }`}
            >
              <TaskPicture icon={i.key} className="h-full w-full rounded-lg" />
            </button>
          ))}
        </div>
      </div>
      <ErrorBox message={error} />
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>
        <Plus size={20} /> {busy ? 'Adding…' : 'Add task'}
      </button>
    </form>
  );
}

// ---------------- Rewards ----------------

type Reward = {
  id: string;
  title: string;
  icon: string;
  kind: RewardKind;
  min_score: number | null;
  task_id: number | null;
  streak_days: number | null;
  member_ids: string[] | null;
};

type RewardDraft = { title: string; icon: string; kids: string[] | null; score: number; taskId: string; streakDays: number };

const emptyDraft = (): RewardDraft => ({ title: '', icon: 'gift', kids: null, score: 10, taskId: '', streakDays: 5 });
const draftFrom = (r: Reward): RewardDraft => ({
  title: r.title,
  icon: r.icon,
  kids: r.member_ids,
  score: r.min_score ?? 10,
  taskId: r.task_id ? String(r.task_id) : '',
  streakDays: r.streak_days ?? 5,
});
/** Every reward is earned with a number of tasks per day. */
const draftBody = (d: RewardDraft) => ({ kind: 'daily', title: d.title, icon: d.icon, minScore: d.score, memberIds: d.kids ?? 'all' });

/** The reward form, used to add a reward (top of the page) and to change one (inside its row). */
function RewardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: RewardDraft;
  submitLabel: string;
  onSubmit: (d: RewardDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (patch: Partial<RewardDraft>) => setD((x) => ({ ...x, ...patch }));

  /** Own picture from the phone/computer (or the camera), cropped square, used as the reward picture. */
  async function uploadOwn(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await api<{ url: string }>('/settings/task-image', { raw: await squareImage(file) });
      set({ icon: url });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!d.title.trim()) return setError('Please write the reward');
    setBusy(true);
    try {
      await onSubmit(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Reward">
        <input className="input" placeholder="e.g. 30 minutes of screen time" maxLength={80} value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Tasks needed per day">
        <input
          className="input sm:w-48"
          type="number"
          min={1}
          max={100}
          value={d.score}
          onChange={(e) => set({ score: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
        />
      </Field>
      <p className="-mt-2 text-sm text-muted">Earned on a day with at least this many tasks done, including all must-do tasks.</p>

      <div>
        <span className="label">Picture</span>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <PhotoSourceButton label="Your own picture" disabled={uploading} onPick={uploadOwn} />
          <span className="text-muted">{uploading ? 'Uploading…' : 'Your own picture, or pick one below'}</span>
          {d.icon.startsWith('https://') && <img src={d.icon} alt="Your picture" className="h-12 w-12 rounded-xl object-cover ring-2 ring-violet" />}
        </div>
        <div className="grid grid-cols-5 gap-2 rounded-2xl bg-white p-2 sm:grid-cols-10">
          {REWARD_ICONS.map((i) => (
            <button
              key={i.key}
              type="button"
              title={i.label}
              aria-label={i.label}
              aria-pressed={d.icon === i.key}
              onClick={() => set({ icon: i.key })}
              className={`grid aspect-square place-items-center rounded-xl border-2 p-1 transition ${d.icon === i.key ? 'border-violet bg-violet-soft' : 'border-transparent hover:bg-soft'}`}
            >
              <img src={rewardIconUrl(i.key)} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">For which kids</span>
        <KidPicker value={d.kids} onChange={(kids) => set({ kids })} />
      </div>
      <ErrorBox message={error} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function RewardsSettings() {
  const { me } = useSession();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [tasks, setTasks] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0); // resets the add form after adding
  const [confirmDialog, confirm] = useConfirm();

  useEffect(() => {
    api<{ rewards: Reward[] }>('/settings/rewards')
      .then((r) => setRewards(r.rewards))
      .catch((e) => setError((e as Error).message));
    api<{ tasks: Template[] }>('/settings/kid-tasks')
      .then((r) => setTasks(r.tasks))
      .catch(() => {});
  }, []);

  const taskTitle = (id: number | null) => tasks.find((t) => t.id === id)?.title;

  async function add(d: RewardDraft) {
    const { reward } = await api<{ reward: Reward }>('/settings/rewards', { body: draftBody(d) });
    setRewards((l) => [...(l ?? []), reward]);
    setFormKey((k) => k + 1);
  }

  async function save(id: string, d: RewardDraft) {
    const { reward } = await api<{ reward: Reward }>(`/settings/rewards/${id}`, { method: 'PATCH', body: draftBody(d) });
    setRewards((l) => l?.map((x) => (x.id === id ? reward : x)) ?? null);
    setEditingId(null);
  }

  async function remove(r: Reward) {
    if (!(await confirm({ title: `Remove "${r.title}"?`, text: 'Kids will no longer see this reward. Past results stay in the Dashboard.' }))) return;
    setError(null);
    const before = rewards;
    setRewards((l) => l?.filter((x) => x.id !== r.id) ?? null); // gone right away
    try {
      await api(`/settings/rewards/${r.id}`, { method: 'DELETE' });
    } catch (e) {
      setRewards(before); // put it back if the server said no
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="rounded-2xl bg-soft p-4 sm:p-5">
        <div className="mb-3 text-lg font-extrabold text-violet">Add a new reward</div>
        <RewardForm key={formKey} initial={emptyDraft()} submitLabel="Add reward" onSubmit={add} />
      </div>

      <section>
        <h3 className="mb-2 text-xl font-extrabold">Your rewards</h3>
        <ErrorBox message={error} />
        {!rewards ? (
          <div className="py-6 text-center text-muted">Loading…</div>
        ) : rewards.length === 0 ? (
          <p className="text-muted">No rewards yet.</p>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => (
              <li key={r.id} className={`rounded-2xl border-2 bg-white p-3 ${editingId === r.id ? 'border-violet' : 'border-line'}`}>
                <div className="flex items-center gap-3">
                  <img src={rewardIconUrl(r.icon)} alt="" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold">{r.title}</div>
                    <div className="text-muted">
                      {rewardRule({ ...r, task_title: taskTitle(r.task_id) })}, for {kidNames(r.member_ids, me?.members ?? [])}
                    </div>
                    {r.kind === 'streak' && (
                      <div className="text-sm font-bold text-danger">Old reward type, not counted anymore. Change it to tasks per day or remove it.</div>
                    )}
                  </div>
                  <button
                    aria-label={`Change ${r.title}`}
                    title="Change reward"
                    aria-expanded={editingId === r.id}
                    className={`rounded-lg p-2 hover:bg-soft hover:text-violet ${editingId === r.id ? 'text-violet' : 'text-muted'}`}
                    onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                  >
                    <Pencil size={20} />
                  </button>
                  <button aria-label={`Remove ${r.title}`} title="Remove reward" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-danger" onClick={() => remove(r)}>
                    <Trash2 size={20} />
                  </button>
                </div>
                {editingId === r.id && (
                  <div className="mt-3 border-t border-line pt-3">
                    <RewardForm initial={draftFrom(r)} submitLabel="Save changes" onSubmit={(d) => save(r.id, d)} onCancel={() => setEditingId(null)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
