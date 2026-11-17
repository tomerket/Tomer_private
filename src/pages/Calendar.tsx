import { Bell, CalendarDays, Cake, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useConfirm } from '../components/ConfirmDialog';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { useSession } from '../lib/session';

export type CalEvent = {
  id: string;
  title: string;
  day: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  note: string | null;
  remind_on: string | null;
  created_by: string | null;
  created_at: string;
};
type Birthday = { memberId: string; name: string; monthDay: string };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const mdy = (s: string) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
export const niceDay = (s: string, todayIso: string) => {
  const label = parse(s).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  if (s === todayIso) return `Today, ${label}`;
  if (s === addDays(todayIso, 1)) return `Tomorrow, ${label}`;
  return label;
};
/** 16:30 -> 4:30 PM */
export const niceTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

/** All days shown in the month grid: whole weeks, Sunday to Saturday. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const last = new Date(year, month + 1, 0);
  const end = new Date(year, month + 1, 0 + (6 - last.getDay()));
  const days: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(iso(d));
  return days;
}

const REMIND_PRESETS = [
  { label: 'No reminder', days: null },
  { label: 'Same day', days: 0 },
  { label: '1 day before', days: 1 },
  { label: '2 days before', days: 2 },
  { label: '1 week before', days: 7 },
] as const;

export default function Calendar() {
  const { me } = useSession();
  const [confirmDialog, confirm] = useConfirm();
  const todayIso = today();
  const [view, setView] = useState(() => ({ y: parse(todayIso).getFullYear(), m: parse(todayIso).getMonth() }));
  const [selected, setSelected] = useState(todayIso);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [reminders, setReminders] = useState<CalEvent[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const isParent = me?.member?.role === 'parent';
  const canChange = (e: CalEvent) => isParent || e.created_by === me?.member?.id;
  const nameOf = (id: string | null) => me?.members.find((m) => m.id === id)?.name;

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ events: CalEvent[]; reminders: CalEvent[]; birthdays: Birthday[] }>(
        `/calendar?from=${grid[0]}&to=${grid[grid.length - 1]}&today=${todayIso}`,
      );
      setEvents(r.events);
      setReminders(r.reminders);
      setBirthdays(r.birthdays);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [grid, todayIso]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    (events ?? []).forEach((e) => m.set(e.day, [...(m.get(e.day) ?? []), e]));
    return m;
  }, [events]);
  const birthdaysOn = (day: string) => birthdays.filter((b) => b.monthDay === day.slice(5));
  const remindsOn = (day: string) => (events ?? []).filter((e) => e.remind_on === day && e.remind_on !== e.day);

  function move(n: number) {
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function goToday() {
    const d = parse(todayIso);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(todayIso);
  }
  function pick(day: string) {
    setSelected(day);
    const d = parse(day);
    if (d.getMonth() !== view.m) setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  async function remove(e: CalEvent) {
    if (!(await confirm({ title: `Delete "${e.title}"?`, confirmLabel: 'Yes, delete' }))) return;
    setError(null);
    const before = events;
    setEvents((l) => l?.filter((x) => x.id !== e.id) ?? null);
    setReminders((l) => l.filter((x) => x.id !== e.id));
    try {
      await api(`/calendar/${e.id}`, { method: 'DELETE' });
    } catch (err) {
      setEvents(before);
      setError((err as Error).message);
    }
  }

  const dayEvents = byDay.get(selected) ?? [];
  const dayBirthdays = birthdaysOn(selected);
  const monthTitle = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <AppLayout title="Calendar" icon={<CalendarDays className="text-violet" />}>
      {confirmDialog}
      {(formOpen || editing) && (
        <EventForm
          key={editing?.id ?? selected}
          initial={editing}
          day={selected}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={(ev) => {
            setFormOpen(false);
            setEditing(null);
            pick(ev.day);
            load();
          }}
        />
      )}

      {reminders.length > 0 && (
        <section className="mb-4 rounded-2xl border-2 border-sun bg-sun-soft p-3 sm:p-4" aria-label="Reminders">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-extrabold text-sun-ink">
            <Bell size={22} /> Reminders
          </h2>
          <ul className="flex flex-wrap gap-2">
            {reminders.map((r) => (
              <li key={r.id}>
                <button className="rounded-xl bg-white px-3 py-1.5 text-left font-bold shadow-sm hover:ring-2 hover:ring-sun" onClick={() => pick(r.day)}>
                  {r.title}
                  <span className="ml-2 font-semibold text-muted">
                    {niceDay(r.day, todayIso)}
                    {r.time ? `, ${niceTime(r.time)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ErrorBox message={error} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Month grid */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <button aria-label="Previous month" className="rounded-xl bg-soft p-2 text-violet hover:bg-violet-soft" onClick={() => move(-1)}>
              <ChevronLeft size={24} />
            </button>
            <h2 className="min-w-[11rem] text-center text-2xl font-extrabold">{monthTitle}</h2>
            <button aria-label="Next month" className="rounded-xl bg-soft p-2 text-violet hover:bg-violet-soft" onClick={() => move(1)}>
              <ChevronRight size={24} />
            </button>
            <button className="btn btn-ghost ml-auto px-4 py-2" onClick={goToday}>
              Today
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-line">
            <div className="grid grid-cols-7 bg-violet text-center text-sm font-extrabold text-white sm:text-base">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((day) => {
                const inMonth = parse(day).getMonth() === view.m;
                const evs = byDay.get(day) ?? [];
                const bds = birthdaysOn(day);
                const bell = remindsOn(day).length > 0;
                const isSel = day === selected;
                const isToday = day === todayIso;
                const count = evs.length + bds.length;
                return (
                  <button
                    key={day}
                    onClick={() => pick(day)}
                    onDoubleClick={() => {
                      pick(day);
                      setFormOpen(true);
                    }}
                    aria-pressed={isSel}
                    aria-label={`${niceDay(day, todayIso)}${count ? `, ${count} item${count > 1 ? 's' : ''}` : ''}`}
                    className={`relative flex min-h-[64px] flex-col items-stretch gap-0.5 border-r border-t border-line p-1 text-left transition sm:min-h-[96px] sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                      isSel ? 'bg-violet-soft ring-2 ring-inset ring-violet' : inMonth ? 'bg-white hover:bg-soft' : 'bg-soft/60 hover:bg-soft'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-sm font-extrabold sm:text-base ${
                          isToday ? 'bg-violet text-white' : inMonth ? 'text-ink' : 'text-muted/60'
                        }`}
                      >
                        {parse(day).getDate()}
                      </span>
                      {bell && <Bell size={14} className="text-sun-ink" aria-hidden />}
                    </span>
                    {/* Small screens: dots. Bigger screens: titles. */}
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {bds.map((b) => (
                        <span key={b.memberId} className="h-2 w-2 rounded-full bg-sun" />
                      ))}
                      {evs.map((e) => (
                        <span key={e.id} className="h-2 w-2 rounded-full bg-violet" />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {bds.map((b) => (
                        <span key={b.memberId} className="truncate rounded-md bg-sun-soft px-1.5 text-xs font-bold text-sun-ink">
                          🎂 {b.name}
                        </span>
                      ))}
                      {evs.slice(0, 3 - Math.min(bds.length, 2)).map((e) => (
                        <span key={e.id} className="truncate rounded-md bg-violet/10 px-1.5 text-xs font-bold text-violet">
                          {e.time ? `${e.time} ` : ''}
                          {e.title}
                        </span>
                      ))}
                      {evs.length > 3 - Math.min(bds.length, 2) && <span className="px-1.5 text-xs font-bold text-muted">+{evs.length - (3 - Math.min(bds.length, 2))} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">Tap a day to see it. Double-click a day to add an activity.</p>
        </section>

        {/* Selected day */}
        <section className="rounded-2xl bg-soft p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xl font-extrabold">{niceDay(selected, todayIso)}</h2>
          </div>
          <button className="btn btn-primary mb-4 w-full" onClick={() => setFormOpen(true)}>
            <Plus size={20} /> Add activity or reminder
          </button>
          {!events ? (
            !error && <p className="text-muted">Loading…</p>
          ) : dayEvents.length === 0 && dayBirthdays.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-muted">Nothing on this day yet.</p>
          ) : (
            <ul className="space-y-2">
              {dayBirthdays.map((b) => (
                <li key={b.memberId} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <Cake className="shrink-0 text-sun-ink" />
                  <span className="text-lg font-bold">{b.name}'s birthday</span>
                </li>
              ))}
              {dayEvents.map((e) => (
                <li key={e.id} className="rounded-2xl bg-white p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-lg font-extrabold">{e.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-semibold text-muted">
                        {e.time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock size={14} /> {niceTime(e.time)}
                          </span>
                        )}
                        {e.remind_on && (
                          <span className="inline-flex items-center gap-1 text-sun-ink">
                            <Bell size={14} /> Reminder {mdy(e.remind_on)}
                          </span>
                        )}
                        {nameOf(e.created_by) && <span>Added by {nameOf(e.created_by)}</span>}
                      </div>
                      {e.note && <p className="mt-1 whitespace-pre-wrap break-words text-ink">{e.note}</p>}
                    </div>
                    {canChange(e) && (
                      <div className="flex shrink-0">
                        <button aria-label={`Change ${e.title}`} title="Change" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-violet" onClick={() => setEditing(e)}>
                          <Pencil size={18} />
                        </button>
                        <button aria-label={`Delete ${e.title}`} title="Delete" className="rounded-lg p-2 text-muted hover:bg-soft hover:text-danger" onClick={() => remove(e)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

/** Add or change an activity: what, which date, optional time, and the day to be reminded. */
function EventForm({ initial, day, onClose, onSaved }: { initial: CalEvent | null; day: string; onClose: () => void; onSaved: (e: CalEvent) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.day ?? day);
  const [time, setTime] = useState(initial?.time ?? '');
  const [remindOn, setRemindOn] = useState(initial?.remind_on ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Please write the activity');
    if (!date) return setError('Please choose a date');
    if (remindOn && remindOn > date) return setError('The reminder must be on or before the activity date');
    setBusy(true);
    try {
      const body = { title, day: date, time: time || null, remindOn: remindOn || null, note };
      const { event } = initial
        ? await api<{ event: CalEvent }>(`/calendar/${initial.id}`, { method: 'PATCH', body })
        : await api<{ event: CalEvent }>('/calendar', { body });
      onSaved(event);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal
        aria-labelledby="event-form-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="panel max-h-[95dvh] w-full max-w-lg space-y-4 overflow-y-auto p-5"
      >
        <div className="flex items-center justify-between">
          <h2 id="event-form-title" className="text-2xl font-extrabold">
            {initial ? 'Change activity' : 'New activity'}
          </h2>
          <button type="button" aria-label="Close" className="p-1 text-muted" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="block">
          <span className="label">Activity *</span>
          <input className="input" autoFocus maxLength={80} placeholder="e.g. Dentist, Noa's soccer game" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Date *</span>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Time</span>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div>
          <span className="label">Remind us on</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REMIND_PRESETS.map((p) => {
              const value = p.days === null ? '' : date ? addDays(date, -p.days) : '';
              const on = remindOn === value;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRemindOn(value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${on ? 'bg-violet text-white' : 'bg-soft text-ink hover:bg-violet-soft'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <input type="date" aria-label="Reminder date" className="input" value={remindOn} max={date || undefined} onChange={(e) => setRemindOn(e.target.value)} />
          <p className="mt-1 text-sm text-muted">From this date until the activity, it shows under Reminders on the Calendar and Home pages.</p>
        </div>
        <label className="block">
          <span className="label">Note</span>
          <textarea className="input min-h-[70px] resize-y" maxLength={500} placeholder="Address, what to bring…" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorBox message={error} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to calendar'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
