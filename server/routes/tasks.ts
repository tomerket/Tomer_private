import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, parseDay, requireText } from '../util.js';

export const tasksRouter = Router();
tasksRouter.use(requireCaller);

const MEMBER_COLS = 'id, family_id, name, role, birthday, is_admin';
export const TEMPLATE_COLS = 'id, title, icon, period, sort_order, member_ids';

const DAY_MS = 86_400_000;
const toDay = (d: Date) => d.toISOString().slice(0, 10);
const shiftDay = (iso: string, n: number) => toDay(new Date(Date.parse(iso) + n * DAY_MS));

/** How many days back the kids page can show (and parents can fix). */
export const DAYS_BACK = 5;

/**
 * Allowed day window. The server only knows UTC, so it allows one extra day on each side
 * to cover the family's time zone; the browser limits the arrows to exactly 5 days.
 */
function checkDayWindow(day: string, forKidEdit = false) {
  const utc = toDay(new Date());
  const min = forKidEdit ? shiftDay(utc, -1) : shiftDay(utc, -(DAYS_BACK + 1));
  if (day < min || day > shiftDay(utc, 1)) {
    throw new HttpError(403, forKidEdit ? 'Only a parent can change earlier days' : `You can only go ${DAYS_BACK} days back`);
  }
}

/** A task with member_ids NULL is for every kid; otherwise only for the listed kids. */
export const appliesTo = (t: { member_ids: string[] | null }, kidId: string) => !t.member_ids || t.member_ids.includes(kidId);

/** Kids may only see/tick their own tasks; parents may for any kid in the family. */
async function kidFor(req: Request): Promise<{ me: Member; kid: Member }> {
  const me = memberOf(req);
  const kidId = String(req.params.memberId);
  if (me.role === 'kid' && me.id !== kidId) throw new HttpError(403, 'You can only see your own tasks');
  const { data: kid } = await db()
    .from('members')
    .select(MEMBER_COLS)
    .eq('id', kidId)
    .eq('family_id', me.family_id)
    .maybeSingle();
  if (!kid || kid.role !== 'kid') throw new HttpError(404, 'Kid not found');
  return { me, kid: kid as Member };
}

tasksRouter.get(
  '/kids/:memberId/tasks',
  handle(async (req, res) => {
    const { kid } = await kidFor(req);
    const day = parseDay(req.query.day);
    checkDayWindow(day);
    const [{ data: templates, error: tErr }, { data: checks, error: cErr }, { data: rewards, error: rErr }] = await Promise.all([
      db().from('kid_task_templates').select(TEMPLATE_COLS).eq('family_id', kid.family_id).is('archived_at', null).order('sort_order'),
      db().from('kid_task_checks').select('template_id').eq('member_id', kid.id).eq('day', day),
      db().from('kid_rewards').select('id, title, min_score, member_ids').eq('family_id', kid.family_id).is('archived_at', null).order('min_score'),
    ]);
    if (tErr || cErr || rErr) throw tErr ?? cErr ?? rErr;
    const done = new Set((checks ?? []).map((c) => c.template_id));
    res.json({
      tasks: (templates ?? [])
        .filter((t) => appliesTo(t, kid.id))
        .map(({ member_ids: _m, ...t }) => ({ ...t, checked: done.has(t.id) })),
      rewards: (rewards ?? []).filter((r) => appliesTo(r, kid.id)).map(({ member_ids: _m, ...r }) => r),
    });
  }),
);

tasksRouter.put(
  '/kids/:memberId/tasks/:templateId',
  handle(async (req, res) => {
    const { me, kid } = await kidFor(req);
    const day = parseDay(req.body?.day);
    checkDayWindow(day, me.role === 'kid'); // kids: today only; parents: up to 5 days back
    const templateId = Number(req.params.templateId);
    if (!Number.isInteger(templateId)) throw new HttpError(400, 'Bad task id');
    const { data: tpl } = await db()
      .from('kid_task_templates')
      .select('id, member_ids')
      .eq('id', templateId)
      .eq('family_id', kid.family_id)
      .maybeSingle();
    if (!tpl || !appliesTo(tpl, kid.id)) throw new HttpError(404, 'Task not found');
    const q = db().from('kid_task_checks');
    const { error } = req.body?.checked
      ? await q.upsert({ member_id: kid.id, template_id: templateId, day, checked_by: me.id })
      : await q.delete().eq('member_id', kid.id).eq('template_id', templateId).eq('day', day);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

/** Parents: stop a task for one kid (e.g. from the Dashboard). Other kids keep it. */
tasksRouter.delete(
  '/kids/:memberId/tasks/:templateId',
  handle(async (req, res) => {
    const me = requireParent(req);
    const { kid } = await kidFor(req);
    const templateId = Number(req.params.templateId);
    const { data: tpl } = await db()
      .from('kid_task_templates')
      .select('id, member_ids')
      .eq('id', templateId)
      .eq('family_id', me.family_id)
      .maybeSingle();
    if (!tpl || !appliesTo(tpl, kid.id)) throw new HttpError(404, 'Task not found for this kid');
    let ids: string[];
    if (tpl.member_ids) ids = tpl.member_ids.filter((id: string) => id !== kid.id);
    else {
      const { data: kids } = await db().from('members').select('id').eq('family_id', me.family_id).eq('role', 'kid');
      ids = (kids ?? []).map((k) => k.id).filter((id) => id !== kid.id);
    }
    const { error } = await db().from('kid_task_templates').update({ member_ids: ids }).eq('id', tpl.id);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

// ---------- Parents tasks (free text): parents only ----------

function requireParent(req: Request): Member {
  const me = memberOf(req);
  if (me.role !== 'parent') throw new HttpError(403, 'This is for parents only');
  return me;
}

async function checkAssignee(familyId: string, assignedTo: unknown): Promise<string | null> {
  if (assignedTo === null || assignedTo === undefined || assignedTo === '') return null;
  const { data } = await db()
    .from('members')
    .select('id')
    .eq('id', String(assignedTo))
    .eq('family_id', familyId)
    .eq('role', 'parent')
    .maybeSingle();
  if (!data) throw new HttpError(400, 'Assignee must be a parent in your family');
  return data.id;
}

// "day" is the start date
const PT_COLS = 'id, subject, text, day, due_date, done, done_at, assigned_to, created_by, created_at';

/** Required end date; must not be before the start date. */
function parseDue(input: unknown, start: string): string {
  if (input === null || input === undefined || input === '') throw new HttpError(400, 'Please choose an end date');
  const due = parseDay(input);
  if (due < start) throw new HttpError(400, 'The end date can’t be before the start date');
  return due;
}

/** Optional description (empty = none). */
function parseDescription(input: unknown): string | null {
  const s = typeof input === 'string' ? input.trim() : '';
  if (s.length > 1000) throw new HttpError(400, 'Description is too long (max 1000)');
  return s || null;
}

/**
 * filter=today (default): tasks that have started by `day` and are not done, plus ones done
 * recently (the browser keeps only those done today, in its own time zone).
 * filter=open: everything not done, including tasks that start later.
 */
tasksRouter.get(
  '/parent-tasks',
  handle(async (req, res) => {
    const me = requireParent(req);
    let q = db().from('parent_tasks').select(PT_COLS).eq('family_id', me.family_id);
    if (req.query.filter === 'open') q = q.eq('done', false);
    else {
      const recent = new Date(Date.now() - 36 * 3_600_000).toISOString();
      q = q.lte('day', parseDay(req.query.day)).or(`done.eq.false,done_at.gte.${recent}`);
    }
    const { data, error } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('day').order('created_at');
    if (error) throw error;
    res.json({ tasks: data });
  }),
);

tasksRouter.post(
  '/parent-tasks',
  handle(async (req, res) => {
    const me = requireParent(req);
    const day = parseDay(req.body?.day);
    const row = {
      family_id: me.family_id,
      created_by: me.id,
      subject: requireText(req.body?.subject, 'Subject', 80),
      text: parseDescription(req.body?.description),
      day,
      due_date: parseDue(req.body?.dueDate, day),
      assigned_to: await checkAssignee(me.family_id, req.body?.assignedTo),
    };
    const { data, error } = await db().from('parent_tasks').insert(row).select(PT_COLS).single();
    if (error) throw error;
    res.status(201).json({ task: data });
  }),
);

tasksRouter.patch(
  '/parent-tasks/:id',
  handle(async (req, res) => {
    const me = requireParent(req);
    const patch: Record<string, unknown> = {};
    if ('subject' in (req.body ?? {})) patch.subject = requireText(req.body.subject, 'Subject', 80);
    if ('description' in (req.body ?? {})) patch.text = parseDescription(req.body.description);
    if ('done' in (req.body ?? {})) {
      patch.done = Boolean(req.body.done);
      patch.done_at = patch.done ? new Date().toISOString() : null;
    }
    if ('assignedTo' in (req.body ?? {})) patch.assigned_to = await checkAssignee(me.family_id, req.body.assignedTo);
    if ('day' in (req.body ?? {}) || 'dueDate' in (req.body ?? {})) {
      const { data: cur } = await db().from('parent_tasks').select('day, due_date').eq('id', req.params.id).eq('family_id', me.family_id).maybeSingle();
      if (!cur) throw new HttpError(404, 'Task not found');
      const start = 'day' in req.body ? parseDay(req.body.day) : cur.day;
      patch.day = start;
      patch.due_date = 'dueDate' in req.body ? parseDue(req.body.dueDate, start) : parseDue(cur.due_date ?? start, start);
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
    const { data, error } = await db()
      .from('parent_tasks')
      .update(patch)
      .eq('id', req.params.id)
      .eq('family_id', me.family_id)
      .select(PT_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Task not found');
    res.json({ task: data });
  }),
);

tasksRouter.delete(
  '/parent-tasks/:id',
  handle(async (req, res) => {
    const me = requireParent(req);
    const { error } = await db().from('parent_tasks').delete().eq('id', req.params.id).eq('family_id', me.family_id);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

// ---------- Dashboard statistics: parents only ----------

const MAX_RANGE_DAYS = 92;
const PERIODS = ['morning', 'general', 'evening'] as const;

type Tpl = {
  id: number;
  title: string;
  icon: string;
  period: (typeof PERIODS)[number];
  sort_order: number;
  member_ids: string[] | null;
  created_at: string;
  archived_at: string | null;
};

/**
 * Completion for one or more kids. A ticked task is "yes"; a task that was on the kid's
 * list that day but not ticked is "no". Tasks only count on days they existed.
 */
tasksRouter.get(
  '/stats',
  handle(async (req, res) => {
    const me = requireParent(req);
    const from = parseDay(req.query.from);
    const to = parseDay(req.query.to);
    if (from > to) throw new HttpError(400, '"From" must be before "To"');
    if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_RANGE_DAYS) throw new HttpError(400, `Pick at most ${MAX_RANGE_DAYS} days`);

    const wanted = String(req.query.memberIds ?? '').split(',').filter(Boolean);
    let kq = db().from('members').select('id, name, created_at').eq('family_id', me.family_id).eq('role', 'kid').order('created_at');
    if (wanted.length && !wanted.includes('all')) kq = kq.in('id', wanted);
    const { data: kids, error: kErr } = await kq;
    if (kErr) throw kErr;
    if (!kids?.length) throw new HttpError(404, 'Kid not found');

    const [{ data: templates, error: tErr }, { data: checks, error: cErr }, { data: rewards, error: rErr }] = await Promise.all([
      db()
        .from('kid_task_templates')
        .select('id, title, icon, period, sort_order, member_ids, created_at, archived_at')
        .eq('family_id', me.family_id)
        .order('sort_order'),
      db()
        .from('kid_task_checks')
        .select('member_id, template_id, day')
        .in('member_id', kids.map((k) => k.id))
        .gte('day', from)
        .lte('day', to),
      db().from('kid_rewards').select('id, title, min_score, member_ids').eq('family_id', me.family_id).is('archived_at', null).order('min_score'),
    ]);
    if (tErr || cErr || rErr) throw tErr ?? cErr ?? rErr;
    const done = new Set((checks ?? []).map((c) => `${c.member_id}|${c.template_id}|${c.day}`));

    const result = kids.map((kid) => {
      const kidStart = toDay(new Date(kid.created_at));
      const mine = (templates as Tpl[]).filter((t) => appliesTo(t, kid.id));
      const activeOn = (t: Tpl, day: string) =>
        day >= toDay(new Date(t.created_at)) && day >= kidStart && (!t.archived_at || day < toDay(new Date(t.archived_at)));
      const myRewards = (rewards ?? []).filter((r) => appliesTo(r, kid.id));
      const rewardScore = Math.min(...myRewards.map((r) => r.min_score), Infinity);

      const days: { day: string; done: number; total: number; reward: boolean }[] = [];
      const perTask = new Map<number, { done: number; total: number }>();
      const periods = Object.fromEntries(PERIODS.map((p) => [p, { done: 0, total: 0 }])) as Record<(typeof PERIODS)[number], { done: number; total: number }>;
      const grid: Record<string, Record<number, 'yes' | 'no'>> = {};
      for (let t = Date.parse(from); t <= Date.parse(to); t += DAY_MS) {
        const day = toDay(new Date(t));
        let dDone = 0;
        let dTotal = 0;
        grid[day] = {};
        for (const tpl of mine) {
          if (!activeOn(tpl, day)) continue;
          const yes = done.has(`${kid.id}|${tpl.id}|${day}`);
          dTotal++;
          if (yes) dDone++;
          grid[day][tpl.id] = yes ? 'yes' : 'no';
          const s = perTask.get(tpl.id) ?? { done: 0, total: 0 };
          s.total++;
          periods[tpl.period].total++;
          if (yes) {
            s.done++;
            periods[tpl.period].done++;
          }
          perTask.set(tpl.id, s);
        }
        const reward = Number.isFinite(rewardScore) && dTotal > 0 && dDone >= Math.min(rewardScore, dTotal);
        days.push({ day, done: dDone, total: dTotal, reward });
      }

      const totalDone = days.reduce((a, d) => a + d.done, 0);
      const total = days.reduce((a, d) => a + d.total, 0);
      return {
        id: kid.id,
        name: kid.name,
        days,
        periods,
        grid,
        // Each reward: how many days in the range it was earned (ticked at least min_score, or all tasks if fewer)
        rewards: myRewards.map((r) => ({
          id: r.id,
          title: r.title,
          min_score: r.min_score,
          earnedDays: days.filter((d) => d.total > 0 && d.done >= Math.min(r.min_score, d.total)).length,
        })),
        tasks: mine
          .filter((t) => perTask.has(t.id))
          .map((t) => ({ id: t.id, title: t.title, icon: t.icon, period: t.period, archived: Boolean(t.archived_at), ...perTask.get(t.id)! })),
        summary: {
          done: totalDone,
          total,
          percent: total ? Math.round((totalDone / total) * 100) : null,
          perfectDays: days.filter((d) => d.total > 0 && d.done === d.total).length,
          rewardDays: Number.isFinite(rewardScore) ? days.filter((d) => d.reward).length : null,
          trackedDays: days.filter((d) => d.total > 0).length,
        },
      };
    });
    res.json({ kids: result });
  }),
);
