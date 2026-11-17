import express, { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db, PHOTO_BUCKET } from '../supabase.js';
import { currentStreak, REWARD_COLS, STREAK_LOOKBACK_DAYS, streaksCompleted, type RewardRow } from '../rewards.js';
import { handle, HttpError, parseDay, requireText } from '../util.js';

export const tasksRouter = Router();
tasksRouter.use(requireCaller);

const MEMBER_COLS = 'id, family_id, name, role, birthday, is_admin';
export const TEMPLATE_COLS = 'id, title, icon, period, sort_order, member_ids, mandatory';

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
      // Today's ticks plus enough history to work out streaks
      db().from('kid_task_checks').select('template_id, day').eq('member_id', kid.id).gte('day', shiftDay(day, -STREAK_LOOKBACK_DAYS)).lte('day', day),
      db().from('kid_rewards').select(REWARD_COLS).eq('family_id', kid.family_id).is('archived_at', null).order('min_score'),
    ]);
    if (tErr || cErr || rErr) throw tErr ?? cErr ?? rErr;
    const done = new Set((checks ?? []).filter((c) => c.day === day).map((c) => c.template_id));
    const mine = (templates ?? []).filter((t) => appliesTo(t, kid.id));
    const daysDone = (taskId: number) => new Set((checks ?? []).filter((c) => c.template_id === taskId).map((c) => c.day));
    res.json({
      tasks: mine.map(({ member_ids: _m, ...t }) => ({ ...t, checked: done.has(t.id) })),
      rewards: (rewards as RewardRow[])
        .filter((r) => appliesTo(r, kid.id) && (r.kind === 'daily' || mine.some((t) => t.id === r.task_id)))
        .map(({ member_ids: _m, ...r }) => {
          if (r.kind !== 'streak') return r;
          const streak = currentStreak(daysDone(r.task_id!), day);
          return { ...r, task_title: mine.find((t) => t.id === r.task_id)?.title, streak, earned: streak >= r.streak_days! };
        }),
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
const PT_COLS = 'id, subject, text, day, due_date, done, done_at, assigned_to, created_by, created_at, photo_path';

/** Adds a short-lived private link for each task photo. */
async function withPhotoUrls<T extends { photo_path: string | null }>(rows: T[]): Promise<(T & { photoUrl: string | null })[]> {
  const paths = rows.map((r) => r.photo_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await db().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
    (data ?? []).forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
  }
  return rows.map((r) => ({ ...r, photoUrl: r.photo_path ? (urls.get(r.photo_path) ?? null) : null }));
}

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
    res.json({ tasks: await withPhotoUrls(data ?? []) });
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
    res.status(201).json({ task: { ...data, photoUrl: null } });
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
    res.json({ task: (await withPhotoUrls([data]))[0] });
  }),
);

tasksRouter.delete(
  '/parent-tasks/:id',
  handle(async (req, res) => {
    const me = requireParent(req);
    const { data: gone, error } = await db().from('parent_tasks').delete().eq('id', req.params.id).eq('family_id', me.family_id).select('photo_path');
    if (error) throw error;
    const paths = (gone ?? []).map((g) => g.photo_path).filter(Boolean) as string[];
    if (paths.length) await db().storage.from(PHOTO_BUCKET).remove(paths);
    res.json({ ok: true });
  }),
);

// Photo on a parents task (uploaded or taken with the phone camera; resized in the browser)
const TASK_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function parentTaskIn(familyId: string, id: string) {
  const { data } = await db().from('parent_tasks').select('id, photo_path').eq('id', id).eq('family_id', familyId).maybeSingle();
  if (!data) throw new HttpError(404, 'Task not found');
  return data as { id: string; photo_path: string | null };
}

tasksRouter.post(
  '/parent-tasks/:id/photo',
  express.raw({ type: TASK_PHOTO_TYPES, limit: '4mb' }),
  handle(async (req, res) => {
    const me = requireParent(req);
    const task = await parentTaskIn(me.family_id, String(req.params.id));
    const type = (req.headers['content-type'] ?? '').split(';')[0];
    if (!TASK_PHOTO_TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Please upload a JPG, PNG or WEBP image');
    const path = `${me.family_id}/parent-tasks/${task.id}-${Date.now()}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error: upErr } = await db().storage.from(PHOTO_BUCKET).upload(path, req.body, { contentType: type });
    if (upErr) throw upErr;
    const { data, error } = await db().from('parent_tasks').update({ photo_path: path }).eq('id', task.id).select(PT_COLS).single();
    if (error) throw error;
    if (task.photo_path) await db().storage.from(PHOTO_BUCKET).remove([task.photo_path]);
    res.json({ task: (await withPhotoUrls([data]))[0] });
  }),
);

tasksRouter.delete(
  '/parent-tasks/:id/photo',
  handle(async (req, res) => {
    const me = requireParent(req);
    const task = await parentTaskIn(me.family_id, String(req.params.id));
    const { data, error } = await db().from('parent_tasks').update({ photo_path: null }).eq('id', task.id).select(PT_COLS).single();
    if (error) throw error;
    if (task.photo_path) await db().storage.from(PHOTO_BUCKET).remove([task.photo_path]);
    res.json({ task: { ...data, photoUrl: null } });
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
  mandatory: boolean;
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
        .select('id, title, icon, period, sort_order, member_ids, mandatory, created_at, archived_at')
        .eq('family_id', me.family_id)
        .order('sort_order'),
      db()
        .from('kid_task_checks')
        .select('member_id, template_id, day')
        .in('member_id', kids.map((k) => k.id))
        .gte('day', shiftDay(from, -STREAK_LOOKBACK_DAYS)) // history before the range, for streaks
        .lte('day', to),
      db().from('kid_rewards').select(REWARD_COLS).eq('family_id', me.family_id).is('archived_at', null).order('min_score'),
    ]);
    if (tErr || cErr || rErr) throw tErr ?? cErr ?? rErr;
    const done = new Set((checks ?? []).map((c) => `${c.member_id}|${c.template_id}|${c.day}`));

    const result = kids.map((kid) => {
      const kidStart = toDay(new Date(kid.created_at));
      const mine = (templates as Tpl[]).filter((t) => appliesTo(t, kid.id));
      const activeOn = (t: Tpl, day: string) =>
        day >= toDay(new Date(t.created_at)) && day >= kidStart && (!t.archived_at || day < toDay(new Date(t.archived_at)));
      const myRewards = (rewards as RewardRow[]).filter((r) => appliesTo(r, kid.id) && (r.kind === 'daily' || mine.some((t) => t.id === r.task_id)));
      const daily = myRewards.filter((r) => r.kind === 'daily');
      const dailyEarned = new Map(daily.map((r) => [r.id, 0]));

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
        // Daily rewards also need every must-do task done that day
        const mustDoDone = mine.every((tpl) => !tpl.mandatory || !activeOn(tpl, day) || done.has(`${kid.id}|${tpl.id}|${day}`));
        let reward = false;
        for (const r of daily) {
          if (dTotal > 0 && mustDoDone && dDone >= Math.min(r.min_score!, dTotal)) {
            dailyEarned.set(r.id, dailyEarned.get(r.id)! + 1);
            reward = true;
          }
        }
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
        // Each reward: how many times it was earned in the range
        rewards: myRewards.map((r) => ({
          id: r.id,
          title: r.title,
          icon: r.icon,
          kind: r.kind,
          min_score: r.min_score,
          streak_days: r.streak_days,
          task_title: r.task_id ? mine.find((t) => t.id === r.task_id)?.title : undefined,
          earned:
            r.kind === 'daily'
              ? dailyEarned.get(r.id)!
              : streaksCompleted(
                  new Set((checks ?? []).filter((c) => c.member_id === kid.id && c.template_id === r.task_id).map((c) => c.day)),
                  from,
                  to,
                  r.streak_days!,
                ),
        })),
        tasks: mine
          .filter((t) => perTask.has(t.id))
          .map((t) => ({ id: t.id, title: t.title, icon: t.icon, period: t.period, archived: Boolean(t.archived_at), ...perTask.get(t.id)! })),
        summary: {
          done: totalDone,
          total,
          percent: total ? Math.round((totalDone / total) * 100) : null,
          perfectDays: days.filter((d) => d.total > 0 && d.done === d.total).length,
          rewardsEarned: null as number | null, // filled in below
          trackedDays: days.filter((d) => d.total > 0).length,
        },
      };
    });
    for (const k of result) k.summary.rewardsEarned = k.rewards.length ? k.rewards.reduce((a, r) => a + r.earned, 0) : null;
    res.json({ kids: result });
  }),
);
