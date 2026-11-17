import { Bell, CalendarDays, Cake, ChevronLeft, ChevronRight, Clock, ListOrdered, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useConfirm } from '../components/ConfirmDialog';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { colorFor, useCategories } from '../lib/categories';
import { useSession } from '../lib/session';

export type CalEvent = {
  id: string;
  title: string;
  day: string; // first day, YYYY-MM-DD
  end_day: string | null; // last day for activities over several days
  time: string | null; // HH:MM
  note: string | null;
  category: string | null;
  remind_on: string | null;
  remind_time: string | null;
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
export const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const md = (s: string) => `${s.slice(5, 7)}/${s.slice(8, 10)}`;
export const mdy = (s: string) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
export const niceDay = (s: string, todayIso: string) => {
  const label = parse(s).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  if (s === todayIso) return `Today, ${label}`;
  if (s === addDays(todayIso, 1)) return `Tomorrow, ${label}`;
  return label;
};
const shortDay = (s: string) => parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
/** "Sat, Dec 20" or "Sat, Dec 20 to Sun, Dec 28" */
export const whenText = (e: Pick<CalEvent, 'day' | 'end_day'>) => (e.end_day ? `${shortDay(e.day)} to ${shortDay(e.end_day)}` : shortDay(e.day));
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
  const end = new Date(year, month + 1, 6 - last.getDay());
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
  const cats = useCategories('calendar');
  const todayIso = today();
  const [view, setView] = useState(() => ({ y: parse(todayIso).getFullYear(), m: parse(todayIso).getMonth() }));
  const [selected, setSelected] = useState(todayIso);
  const [panel, setPanel] = useState<'day' | 'next'>('day');
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [reminders, setReminders] = useState<CalEvent[]>([]);
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reload, setReload] = useState(0);

  const grid = useMemo(() => monthGrid(view.y, view.m), [view]);
  const isParent = me?.member?.role === 'parent';
  const canChange = (e: CalEvent) => isParent || e.created_by === me?.member?.id;
  const nameOf = (id: string | null) => me?.members.find((m) => m.id === id)?.name;

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ events: CalEvent[]; reminders: CalEvent[]; birthdays: Birthday[] }>(
        `/calendar?from=${grid[0]}&to=${grid[grid.length - 1]}&today=${todayIso}&now=${nowHM()}`,
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
  }, [load, reload]);

  // Each activity shows on every day it runs
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events ?? []) {
      for (let d = e.day; d <= (e.end_day ?? e.day); d = addDays(d, 1)) m.set(d, [...(m.get(d) ?? []), e]);
    }
    return m;
  }, [events]);
  const birthdaysOn = (day: string) => birthdays.filter((b) => b.monthDay === day.slice(5));
  const remindsOn = (day: string) => (events ?? []).some((e) => e.remind_on === day && e.remind_on !== e.day);

  function move(n: number) {
    setView(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function pick(day: string) {
    setSelected(day);
    setPanel('day');
    const d = parse(day);
    if (d.getMonth() !== view.m || d.getFullYear() !== view.y) setView({ y: d.getFullYear(), m: d.getMonth() });
  }

  async function remove(e: CalEvent) {
    if (!(await confirm({ title: `Delete "${e.title}"?`, confirmLabel: 'Yes, delete' }))) return;
    setError(null);
    const before = events;
    setEvents((l) => l?.filter((x) => x.id !== e.id) ?? null);
    setReminders((l) => l.filter((x) => x.id !== e.id));
    try {
      await api(`/calendar/${e.id}`, { method: 'DELETE' });
      setReload((n) => n + 1);
    } catch (err) {
      setEvents(before);
      setError((err as Error).message);
    }
  }

  const dayEvents = byDay.get(selected) ?? [];
  const dayBirthdays = birthdaysOn(selected);
  const monthTitle = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const eventCard = (e: CalEvent, showDate: boolean) => {
    const c = colorFor(e.category, cats.names);
    return (
      <li key={e.id} className="rounded-2xl border-l-[6px] bg-white p-3" style={{ borderColor: e.category ? c.fg : 'var(--color-line)' }}>
        <div className="flex items-start gap-2">
          <button className="min-w-0 flex-1 text-left" onClick={() => showDate && pick(e.day)} disabled={!showDate}>
            <div className="break-words text-lg font-extrabold">{e.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-semibold text-muted">
              {e.category && (
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: c.bg, color: c.fg }}>
                  {e.category}
                </span>
              )}
              {(showDate || e.end_day) && <span className="text-ink">{whenText(e)}</span>}
              {e.time && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} /> {niceTime(e.time)}
                </span>
              )}
              {e.remind_on && (
                <span className="inline-flex items-center gap-1 text-sun-ink">
                  <Bell size={14} /> {md(e.remind_on)}
                  {e.remind_time ? `, ${niceTime(e.remind_time)}` : ''}
                </span>
              )}
              {!showDate && nameOf(e.created_by) && <span>Added by {nameOf(e.created_by)}</span>}
            </div>
            {e.note && !showDate && <p className="mt-1 whitespace-pre-wrap break-words text-ink">{e.note}</p>}
          </button>
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
    );
  };

  return (
    <AppLayout title="Calendar" icon={<CalendarDays className="text-violet" />}>
      {confirmDialog}
      {(formOpen || editing) && (
        <EventForm
          key={editing?.id ?? selected}
          initial={editing}
          day={selected}
          cats={cats}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={(ev) => {
            setFormOpen(false);
            setEditing(null);
            pick(ev.day);
            setReload((n) => n + 1);
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
                    {r.end_day ? whenText(r) : niceDay(r.day, todayIso)}
                    {r.time ? `, ${niceTime(r.time)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ErrorBox message={error} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
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
            <button className="btn btn-ghost ml-auto px-4 py-2" onClick={() => pick(todayIso)}>
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
                const isSel = day === selected;
                const count = evs.length + bds.length;
                const room = 3 - Math.min(bds.length, 2);
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
                          day === todayIso ? 'bg-violet text-white' : inMonth ? 'text-ink' : 'text-muted/60'
                        }`}
                      >
                        {parse(day).getDate()}
                      </span>
                      {remindsOn(day) && <Bell size={14} className="text-sun-ink" aria-hidden />}
                    </span>
                    {/* Small screens: dots. Bigger screens: titles in the category color. */}
                    <span className="flex flex-wrap gap-0.5 sm:hidden">
                      {bds.map((b) => (
                        <span key={b.memberId} className="h-2 w-2 rounded-full bg-sun" />
                      ))}
                      {evs.map((e) => (
                        <span key={e.id} className="h-2 w-2 rounded-full" style={{ background: e.category ? colorFor(e.category, cats.names).fg : 'var(--color-violet)' }} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {bds.map((b) => (
                        <span key={b.memberId} className="truncate rounded-md bg-sun-soft px-1.5 text-xs font-bold text-sun-ink">
                          🎂 {b.name}
                        </span>
                      ))}
                      {evs.slice(0, room).map((e) => {
                        const c = e.category ? colorFor(e.category, cats.names) : { bg: 'rgb(109 59 245 / 0.1)', fg: 'var(--color-violet)' };
                        const cont = e.day < day; // continues from an earlier day
                        return (
                          <span key={e.id} className="truncate rounded-md px-1.5 text-xs font-bold" style={{ background: c.bg, color: c.fg }}>
                            {cont ? '↳ ' : e.time ? `${e.time} ` : ''}
                            {e.title}
                          </span>
                        );
                      })}
                      {evs.length > room && <span className="px-1.5 text-xs font-bold text-muted">+{evs.length - room} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">Tap a day to see it. Double-click a day to add an activity.</p>
        </section>

        {/* Right side: the chosen day, or the next 10 activities */}
        <section className="rounded-2xl bg-soft p-4">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-white p-1">
            <button
              aria-pressed={panel === 'day'}
              onClick={() => setPanel('day')}
              className={`rounded-full px-3 py-2 font-bold transition ${panel === 'day' ? 'bg-violet text-white shadow' : 'text-muted'}`}
            >
              {selected === todayIso ? 'Today' : md(selected)}
            </button>
            <button
              aria-pressed={panel === 'next'}
              onClick={() => setPanel('next')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 font-bold transition ${panel === 'next' ? 'bg-violet text-white shadow' : 'text-muted'}`}
            >
              <ListOrdered size={18} /> Next 10
            </button>
          </div>

          {panel === 'day' ? (
            <>
              <h2 className="mb-3 text-xl font-extrabold">{niceDay(selected, todayIso)}</h2>
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
                  {dayEvents.map((e) => eventCard(e, false))}
                </ul>
              )}
            </>
          ) : (
            <Upcoming todayIso={todayIso} categories={cats.names} reload={reload} renderEvent={(e) => eventCard(e, true)} />
          )}
        </section>
      </div>
    </AppLayout>
  );
}

/** The next 10 activities from today, all or in one category, with a Share button. */
function Upcoming({
  todayIso,
  categories,
  reload,
  renderEvent,
}: {
  todayIso: string;
  categories: string[];
  reload: number;
  renderEvent: (e: CalEvent) => React.ReactNode;
}) {
  const [cat, setCat] = useState('');
  const [list, setList] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setList(null);
    setError(null);
    api<{ events: CalEvent[] }>(`/calendar/upcoming?today=${todayIso}${cat ? `&category=${encodeURIComponent(cat)}` : ''}`)
      .then((r) => !stale && setList(r.events))
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
  }, [todayIso, cat, reload]);

  async function share() {
    if (!list?.length) return;
    const text = [
      cat ? `Next ${cat} activities:` : 'Our next activities:',
      ...list.map((e) => `• ${whenText(e)}${e.time ? `, ${niceTime(e.time)}` : ''}: ${e.title}${e.category && !cat ? ` (${e.category})` : ''}`),
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Family calendar', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared('Copied. Paste it in a message.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShared("Couldn't share from this browser.");
    }
    setTimeout(() => setShared(null), 3000);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-xl font-extrabold">Next 10 activities</h2>
        <button className="btn btn-ghost bg-white px-3 py-2" onClick={share} disabled={!list?.length}>
          <Share2 size={18} /> Share
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {['', ...categories].map((c) => {
          const col = c ? colorFor(c, categories) : null;
          const on = cat === c;
          return (
            <button
              key={c || 'all'}
              aria-pressed={on}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1 text-sm font-bold ring-2 transition ${on ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}
              style={col ? { background: col.bg, color: col.fg } : { background: '#fff', color: 'var(--color-ink)' }}
            >
              {c || 'All'}
            </button>
          );
        })}
      </div>
      {shared && <p className="mb-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-violet">{shared}</p>}
      <ErrorBox message={error} />
      {!list ? (
        !error && <p className="text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-4 text-center text-muted">{cat ? `Nothing coming up in ${cat}.` : 'Nothing coming up.'}</p>
      ) : (
        <ul className="space-y-2">{list.map(renderEvent)}</ul>
      )}
    </div>
  );
}

/** Add or change an activity: what, category, dates, time, and when to be reminded. */
function EventForm({
  initial,
  day,
  cats,
  onClose,
  onSaved,
}: {
  initial: CalEvent | null;
  day: string;
  cats: ReturnType<typeof useCategories>;
  onClose: () => void;
  onSaved: (e: CalEvent) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [newCat, setNewCat] = useState<string | null>(null);
  const [date, setDate] = useState(initial?.day ?? day);
  const [endDate, setEndDate] = useState(initial?.end_day ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [remindOn, setRemindOn] = useState(initial?.remind_on ?? '');
  const [remindTime, setRemindTime] = useState(initial?.remind_time ?? '');
  /** Picking a reminder date fills in 8:00 AM unless a time was already chosen. */
  const chooseRemind = (v: string) => {
    setRemindOn(v);
    if (v && !remindTime) setRemindTime('08:00');
  };
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && newCat === null && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, newCat]);

  async function saveCategory() {
    const name = (newCat ?? '').trim();
    if (!name) return setNewCat(null);
    setError(null);
    try {
      setCategory(await cats.add(name));
      setNewCat(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Please write the activity');
    if (!date) return setError('Please choose a date');
    if (endDate && endDate < date) return setError('The end date can’t be before the start date');
    if (remindOn && remindOn > date) return setError('The reminder must be on or before the activity date');
    setBusy(true);
    try {
      const body = {
        title,
        category: category || null,
        day: date,
        endDay: endDate || null,
        time: time || null,
        remindOn: remindOn || null,
        remindTime: remindOn ? remindTime || null : null,
        note,
      };
      const { event } = initial
        ? await api<{ event: CalEvent }>(`/calendar/${initial.id}`, { method: 'PATCH', body })
        : await api<{ event: CalEvent }>('/calendar', { body });
      onSaved(event);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Keep a category that is no longer in the family's list (e.g. removed later) selectable
  const options = category && !cats.names.includes(category) ? [...cats.names, category] : cats.names;

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
          <input className="input" autoFocus maxLength={80} placeholder="e.g. Dentist, family trip" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <div>
          <span className="label">Category</span>
          {newCat === null ? (
            <div className="flex flex-wrap gap-1.5">
              {['', ...options].map((c) => {
                const col = c ? colorFor(c, cats.names) : null;
                const on = category === c;
                return (
                  <button
                    key={c || 'none'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ring-2 transition ${on ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}
                    style={col ? { background: col.bg, color: col.fg } : { background: 'var(--color-soft)', color: 'var(--color-muted)' }}
                  >
                    {c || 'None'}
                  </button>
                );
              })}
              <button type="button" className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-line px-3 py-1 text-sm font-bold text-violet hover:bg-violet-soft" onClick={() => setNewCat('')}>
                <Plus size={16} /> New category
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1"
                autoFocus
                maxLength={30}
                placeholder="e.g. School, Sports, Holidays"
                aria-label="New category name"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveCategory();
                  }
                  if (e.key === 'Escape') setNewCat(null);
                }}
              />
              <button type="button" className="btn btn-primary shrink-0 px-3" onClick={saveCategory}>
                Save
              </button>
              <button type="button" className="btn btn-ghost shrink-0 px-3" aria-label="Cancel new category" onClick={() => setNewCat(null)}>
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Start date *</span>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">End date</span>
            <input type="date" className="input" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Time</span>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <p className="-mt-2 text-sm text-muted">Leave the end date empty for a one-day activity.</p>

        <div>
          <span className="label">Remind us</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REMIND_PRESETS.map((p) => {
              const value = p.days === null ? '' : date ? addDays(date, -p.days) : '';
              const on = remindOn === value;
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => chooseRemind(value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${on ? 'bg-violet text-white' : 'bg-soft text-ink hover:bg-violet-soft'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-muted">Reminder date</span>
              <input type="date" className="input" value={remindOn} max={date || undefined} onChange={(e) => chooseRemind(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-muted">Reminder time</span>
              <input type="time" className="input" value={remindTime} disabled={!remindOn} onChange={(e) => setRemindTime(e.target.value)} />
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">From then until the activity is over, it shows under Reminders on the Calendar and Home pages.</p>
        </div>

        <label className="block">
          <span className="label">Note</span>
          <textarea className="input min-h-[70px] resize-y" maxLength={500} placeholder="Address, what to bring…" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorBox message={error} />
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={busy || newCat !== null}>
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
