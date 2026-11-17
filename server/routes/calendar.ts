import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, parseDay, requireText } from '../util.js';
import { canSee, parseSharedWith, visibleTo } from '../sharing.js';

export const calendarRouter = Router();
calendarRouter.use('/calendar', requireCaller);

const EV_COLS = 'id, title, day, end_day, time, note, category, remind_on, remind_time, shared_with, created_by, created_at';

/** Both conditions (each an OR-list) in one PostgREST `or` filter. */
const both = (a: string, b: string) => `and(or(${a}),or(${b}))`;
const MAX_RANGE_DAYS = 62;
const UPCOMING = 10;

type Ev = { day: string; end_day: string | null; remind_on: string | null; remind_time: string | null; time: string | null };

function parseTime(input: unknown, what = 'Time'): string | null {
  if (input === null || input === undefined || input === '') return null;
  const s = String(input);
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s)) throw new HttpError(400, `${what} must be like 16:30`);
  return s;
}

function parseNote(input: unknown): string | null {
  const s = typeof input === 'string' ? input.trim() : '';
  if (s.length > 500) throw new HttpError(400, 'Note is too long (max 500)');
  return s || null;
}

function parseCategory(input: unknown): string | null {
  const s = typeof input === 'string' ? input.trim() : '';
  if (s.length > 30) throw new HttpError(400, 'Category is too long (max 30)');
  return s || null;
}

/** Optional last day for activities that run over several days (same day = one-day activity). */
function parseEnd(input: unknown, day: string): string | null {
  if (input === null || input === undefined || input === '') return null;
  const e = parseDay(input);
  if (e < day) throw new HttpError(400, 'The end date can’t be before the start date');
  return e === day ? null : e;
}

/** Optional reminder day: on or before the activity's first day. */
function parseRemind(input: unknown, day: string): string | null {
  if (input === null || input === undefined || input === '') return null;
  const r = parseDay(input);
  if (r > day) throw new HttpError(400, 'The reminder must be on or before the activity date');
  return r;
}

/** Activities still going on (or coming) on `day`: last day is today or later. */
const notOverOn = (day: string) => `end_day.gte.${day},and(end_day.is.null,day.gte.${day})`;

/** Anyone it is shared with can change or delete it (only the creator changes who it is shared with). */
async function eventFor(req: Request): Promise<{ me: Member; ev: Ev & { id: string; created_by: string | null } }> {
  const me = memberOf(req);
  const { data } = await db()
    .from('calendar_events')
    .select('id, day, end_day, time, remind_on, remind_time, shared_with, created_by')
    .eq('id', String(req.params.id))
    .eq('family_id', me.family_id)
    .maybeSingle();
  if (!data || !canSee(data, me)) throw new HttpError(404, 'Activity not found'); // not shared with you = not there
  return { me, ev: data };
}

/**
 * Activities touching a date range, family birthdays (month-day), and the reminders due now.
 * `today` and `now` (HH:MM) come from the browser, which knows the family's time zone.
 */
calendarRouter.get(
  '/calendar',
  handle(async (req, res) => {
    const me = memberOf(req);
    const from = parseDay(req.query.from);
    const to = parseDay(req.query.to);
    const today = parseDay(req.query.today ?? to);
    const now = parseTime(req.query.now, 'now') ?? '23:59';
    if (from > to) throw new HttpError(400, '"From" must be before "To"');
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_RANGE_DAYS) throw new HttpError(400, 'Range is too long');
    const [{ data: events, error }, { data: reminders, error: rErr }, { data: members, error: mErr }] = await Promise.all([
      db().from('calendar_events').select(EV_COLS).eq('family_id', me.family_id).lte('day', to).or(both(notOverOn(from), visibleTo(me))).order('day').order('time', { nullsFirst: true }),
      db().from('calendar_events').select(EV_COLS).eq('family_id', me.family_id).lte('remind_on', today).or(both(notOverOn(today), visibleTo(me))).order('day').order('time', { nullsFirst: true }),
      db().from('members').select('id, name, birthday').eq('family_id', me.family_id),
    ]);
    if (error || rErr || mErr) throw error ?? rErr ?? mErr;
    res.json({
      events: events ?? [],
      // A reminder with a time shows from that time on its day
      reminders: ((reminders ?? []) as Ev[]).filter((r) => r.remind_on! < today || !r.remind_time || r.remind_time <= now),
      birthdays: (members ?? []).map((m) => ({ memberId: m.id, name: m.name, monthDay: String(m.birthday).slice(5, 10) })),
    });
  }),
);

/** The next activities from today (still going on or coming), optionally in one category. */
calendarRouter.get(
  '/calendar/upcoming',
  handle(async (req, res) => {
    const me = memberOf(req);
    const today = parseDay(req.query.today);
    let q = db().from('calendar_events').select(EV_COLS).eq('family_id', me.family_id).or(both(notOverOn(today), visibleTo(me)));
    if (typeof req.query.category === 'string' && req.query.category) q = q.eq('category', req.query.category);
    const { data, error } = await q.order('day').order('time', { nullsFirst: true }).limit(UPCOMING);
    if (error) throw error;
    res.json({ events: data ?? [] });
  }),
);

calendarRouter.post(
  '/calendar',
  handle(async (req, res) => {
    const me = memberOf(req);
    const b = req.body ?? {};
    const day = parseDay(b.day);
    const remind_on = parseRemind(b.remindOn, day);
    const row = {
      family_id: me.family_id,
      created_by: me.id,
      title: requireText(b.title, 'Activity', 80),
      day,
      end_day: parseEnd(b.endDay, day),
      time: parseTime(b.time),
      note: parseNote(b.note),
      category: parseCategory(b.category),
      remind_on,
      remind_time: remind_on ? parseTime(b.remindTime, 'Reminder time') : null,
      shared_with: await parseSharedWith(b.sharedWith, me), // not chosen = only the creator
    };
    const { data, error } = await db().from('calendar_events').insert(row).select(EV_COLS).single();
    if (error) throw error;
    res.status(201).json({ event: data });
  }),
);

calendarRouter.patch(
  '/calendar/:id',
  handle(async (req, res) => {
    const { me, ev } = await eventFor(req);
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if ('title' in b) patch.title = requireText(b.title, 'Activity', 80);
    if ('time' in b) patch.time = parseTime(b.time);
    if ('note' in b) patch.note = parseNote(b.note);
    if ('category' in b) patch.category = parseCategory(b.category);
    if ('sharedWith' in b) {
      if (ev.created_by !== me.id) throw new HttpError(403, 'Only the person who added it can change who it is shared with');
      patch.shared_with = await parseSharedWith(b.sharedWith, me);
    }
    const day = 'day' in b ? parseDay(b.day) : ev.day;
    if ('day' in b) patch.day = day;
    if ('endDay' in b) patch.end_day = parseEnd(b.endDay, day);
    else if ('day' in b && ev.end_day && ev.end_day < day) patch.end_day = null; // moved past its old end
    if ('remindOn' in b) {
      patch.remind_on = parseRemind(b.remindOn, day);
      if (!patch.remind_on) patch.remind_time = null;
    } else if ('day' in b && ev.remind_on && ev.remind_on > day) patch.remind_on = day; // keep the reminder before the activity
    const remindOn = 'remind_on' in patch ? patch.remind_on : ev.remind_on;
    if ('remindTime' in b) patch.remind_time = remindOn ? parseTime(b.remindTime, 'Reminder time') : null;
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
    const { data, error } = await db().from('calendar_events').update(patch).eq('id', ev.id).eq('family_id', me.family_id).select(EV_COLS).single();
    if (error) throw error;
    res.json({ event: data });
  }),
);

calendarRouter.delete(
  '/calendar/:id',
  handle(async (req, res) => {
    const { me, ev } = await eventFor(req);
    const { error } = await db().from('calendar_events').delete().eq('id', ev.id).eq('family_id', me.family_id);
    if (error) throw error;
    res.json({ ok: true });
  }),
);
