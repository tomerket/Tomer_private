import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, parseDay, requireText } from '../util.js';

export const calendarRouter = Router();
calendarRouter.use('/calendar', requireCaller);

const EV_COLS = 'id, title, day, time, note, remind_on, created_by, created_at';
const MAX_RANGE_DAYS = 62;

function parseTime(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  const s = String(input);
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s)) throw new HttpError(400, 'Time must be like 16:30');
  return s;
}

function parseNote(input: unknown): string | null {
  const s = typeof input === 'string' ? input.trim() : '';
  if (s.length > 500) throw new HttpError(400, 'Note is too long (max 500)');
  return s || null;
}

/** Optional reminder day: on or before the activity day. */
function parseRemind(input: unknown, day: string): string | null {
  if (input === null || input === undefined || input === '') return null;
  const r = parseDay(input);
  if (r > day) throw new HttpError(400, 'The reminder must be on or before the activity date');
  return r;
}

/** Parents can change anything; kids only what they added. */
async function eventFor(req: Request): Promise<{ me: Member; ev: { id: string; day: string; created_by: string | null } }> {
  const me = memberOf(req);
  const { data } = await db().from('calendar_events').select('id, day, created_by').eq('id', String(req.params.id)).eq('family_id', me.family_id).maybeSingle();
  if (!data) throw new HttpError(404, 'Activity not found');
  if (me.role !== 'parent' && data.created_by !== me.id) throw new HttpError(403, 'You can only change what you added');
  return { me, ev: data };
}

/** Activities in a date range, plus family birthdays (month-day) and today's reminders. */
calendarRouter.get(
  '/calendar',
  handle(async (req, res) => {
    const me = memberOf(req);
    const from = parseDay(req.query.from);
    const to = parseDay(req.query.to);
    const today = parseDay(req.query.today ?? to);
    if (from > to) throw new HttpError(400, '"From" must be before "To"');
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_RANGE_DAYS) throw new HttpError(400, 'Range is too long');
    const [{ data: events, error }, { data: reminders, error: rErr }, { data: members, error: mErr }] = await Promise.all([
      db().from('calendar_events').select(EV_COLS).eq('family_id', me.family_id).gte('day', from).lte('day', to).order('day').order('time', { nullsFirst: true }),
      // Reminders showing today: the reminder day has come and the activity hasn't passed yet
      db().from('calendar_events').select(EV_COLS).eq('family_id', me.family_id).lte('remind_on', today).gte('day', today).order('day').order('time', { nullsFirst: true }),
      db().from('members').select('id, name, birthday').eq('family_id', me.family_id),
    ]);
    if (error || rErr || mErr) throw error ?? rErr ?? mErr;
    res.json({
      events: events ?? [],
      reminders: reminders ?? [],
      birthdays: (members ?? []).map((m) => ({ memberId: m.id, name: m.name, monthDay: String(m.birthday).slice(5, 10) })),
    });
  }),
);

calendarRouter.post(
  '/calendar',
  handle(async (req, res) => {
    const me = memberOf(req);
    const day = parseDay(req.body?.day);
    const row = {
      family_id: me.family_id,
      created_by: me.id,
      title: requireText(req.body?.title, 'Activity', 80),
      day,
      time: parseTime(req.body?.time),
      note: parseNote(req.body?.note),
      remind_on: parseRemind(req.body?.remindOn, day),
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
    const day = 'day' in b ? parseDay(b.day) : ev.day;
    if ('day' in b) patch.day = day;
    if ('remindOn' in b) patch.remind_on = parseRemind(b.remindOn, day);
    else if ('day' in b) {
      // Moving the activity earlier than its reminder: move the reminder with it
      const { data: cur } = await db().from('calendar_events').select('remind_on').eq('id', ev.id).single();
      if (cur?.remind_on && cur.remind_on > day) patch.remind_on = day;
    }
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
