import { randomUUID } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db, PHOTO_BUCKET } from '../supabase.js';
import { handle, HttpError, parseBirthday, requireText } from '../util.js';
import { REWARD_COLS } from '../rewards.js';
import { TEMPLATE_COLS } from './tasks.js';

/** Admin settings: manage family members and the kids task list. Admin (email login) only. */
export const settingsRouter = Router();
settingsRouter.use('/settings', requireCaller);

function requireAdmin(req: Request): Member {
  const me = memberOf(req);
  if (req.caller!.kind !== 'admin' || !me.is_admin) throw new HttpError(403, 'Only the family admin can change settings');
  return me;
}

// ----- Members -----

settingsRouter.post(
  '/settings/members',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const role = req.body?.role;
    if (role !== 'kid' && role !== 'parent') throw new HttpError(400, 'Choose Kid or Parent');
    const row = {
      family_id: me.family_id,
      name: requireText(req.body?.name, 'Name', 40),
      role,
      birthday: parseBirthday(req.body?.birthday),
    };
    const { count } = await db().from('members').select('id', { count: 'exact', head: true }).eq('family_id', me.family_id);
    if ((count ?? 0) >= 20) throw new HttpError(400, 'A family can have up to 20 members');
    const { data, error } = await db().from('members').insert(row).select('id').single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, `There is already a family member named ${row.name}`);
      throw error;
    }
    res.status(201).json({ id: data.id });
  }),
);

settingsRouter.delete(
  '/settings/members/:id',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const { data: target } = await db()
      .from('members')
      .select('id, is_admin, photo_path')
      .eq('id', req.params.id)
      .eq('family_id', me.family_id)
      .maybeSingle();
    if (!target) throw new HttpError(404, 'Family member not found');
    if (target.is_admin) throw new HttpError(400, "The admin can't be removed");
    const { error } = await db().from('members').delete().eq('id', target.id).eq('family_id', me.family_id);
    if (error) throw error;
    if (target.photo_path) await db().storage.from(PHOTO_BUCKET).remove([target.photo_path]);
    res.json({ ok: true });
  }),
);

// ----- Member face photos (already cropped to a square in the browser) -----

const FACE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function memberInFamily(familyId: string, id: string) {
  const { data } = await db().from('members').select('id, photo_path').eq('id', id).eq('family_id', familyId).maybeSingle();
  if (!data) throw new HttpError(404, 'Family member not found');
  return data as { id: string; photo_path: string | null };
}

settingsRouter.post(
  '/settings/members/:id/photo',
  express.raw({ type: FACE_TYPES, limit: '2mb' }),
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const member = await memberInFamily(me.family_id, String(req.params.id));
    const type = (req.headers['content-type'] ?? '').split(';')[0];
    if (!FACE_TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Please upload a JPG, PNG or WEBP image');
    const path = `${me.family_id}/members/${member.id}-${Date.now()}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error: upErr } = await db().storage.from(PHOTO_BUCKET).upload(path, req.body, { contentType: type });
    if (upErr) throw upErr;
    const { error } = await db().from('members').update({ photo_path: path }).eq('id', member.id);
    if (error) throw error;
    if (member.photo_path) await db().storage.from(PHOTO_BUCKET).remove([member.photo_path]);
    res.json({ ok: true });
  }),
);

settingsRouter.delete(
  '/settings/members/:id/photo',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const member = await memberInFamily(me.family_id, String(req.params.id));
    const { error } = await db().from('members').update({ photo_path: null }).eq('id', member.id);
    if (error) throw error;
    if (member.photo_path) await db().storage.from(PHOTO_BUCKET).remove([member.photo_path]);
    res.json({ ok: true });
  }),
);

// ----- Own photos for kids tasks (public bucket, random names) -----

const TASK_IMAGES = 'task-images';
const taskImagePrefix = (familyId: string) => `${process.env.SUPABASE_URL}/storage/v1/object/public/${TASK_IMAGES}/${familyId}/`;

settingsRouter.post(
  '/settings/task-image',
  express.raw({ type: FACE_TYPES, limit: '2mb' }),
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const type = (req.headers['content-type'] ?? '').split(';')[0];
    if (!FACE_TYPES.includes(type) || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Please upload a JPG, PNG or WEBP image');
    const path = `${me.family_id}/${randomUUID()}.${type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error } = await db().storage.from(TASK_IMAGES).upload(path, req.body, { contentType: type });
    if (error) throw error;
    res.status(201).json({ url: db().storage.from(TASK_IMAGES).getPublicUrl(path).data.publicUrl });
  }),
);

// ----- Kids tasks -----

const PERIODS = ['morning', 'general', 'evening'];

/** null/empty/"all" = all kids; otherwise every id must be a kid in this family. */
async function parseKidIds(familyId: string, input: unknown): Promise<string[] | null> {
  if (input === null || input === undefined || input === 'all') return null;
  if (!Array.isArray(input)) throw new HttpError(400, 'Choose which kids');
  const ids = [...new Set(input.map(String))];
  if (ids.length === 0) throw new HttpError(400, 'Choose at least one kid, or All kids');
  const { data } = await db().from('members').select('id').eq('family_id', familyId).eq('role', 'kid').in('id', ids);
  if ((data ?? []).length !== ids.length) throw new HttpError(400, 'Unknown kid selected');
  return ids;
}

settingsRouter.get(
  '/settings/kid-tasks',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const { data, error } = await db()
      .from('kid_task_templates')
      .select(TEMPLATE_COLS)
      .eq('family_id', me.family_id)
      .is('archived_at', null)
      .order('sort_order');
    if (error) throw error;
    res.json({ tasks: data });
  }),
);

settingsRouter.post(
  '/settings/kid-tasks',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const title = requireText(req.body?.title, 'Task name', 60);
    const period = String(req.body?.period ?? '');
    if (!PERIODS.includes(period)) throw new HttpError(400, 'Choose Morning, General or Evening');
    const icon = String(req.body?.icon ?? '');
    // A built-in picture key, or a photo this family uploaded
    if (!/^[a-z0-9-]{1,30}$/.test(icon) && !icon.startsWith(taskImagePrefix(me.family_id))) throw new HttpError(400, 'Choose a picture');
    const member_ids = await parseKidIds(me.family_id, req.body?.memberIds);

    const { count } = await db()
      .from('kid_task_templates')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', me.family_id)
      .is('archived_at', null);
    if ((count ?? 0) >= 40) throw new HttpError(400, 'You can have up to 40 kids tasks');

    const { data: last } = await db()
      .from('kid_task_templates')
      .select('sort_order')
      .eq('family_id', me.family_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const { data, error } = await db()
      .from('kid_task_templates')
      .insert({ family_id: me.family_id, title, period, icon, member_ids, sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
      .select(TEMPLATE_COLS)
      .single();
    if (error) throw error;
    res.status(201).json({ task: data });
  }),
);

/** Set the must-do tasks: the listed ones become mandatory, all others not. */
settingsRouter.put(
  '/settings/kid-tasks/mandatory',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const ids: number[] = Array.isArray(req.body?.taskIds) ? req.body.taskIds.map(Number).filter(Number.isInteger) : [];
    const { error: offErr } = await db().from('kid_task_templates').update({ mandatory: false }).eq('family_id', me.family_id).is('archived_at', null);
    if (offErr) throw offErr;
    if (ids.length) {
      const { error } = await db().from('kid_task_templates').update({ mandatory: true }).eq('family_id', me.family_id).in('id', ids);
      if (error) throw error;
    }
    res.json({ ok: true });
  }),
);

/** Change which kids a task is for. */
settingsRouter.patch(
  '/settings/kid-tasks/:id',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const member_ids = await parseKidIds(me.family_id, req.body?.memberIds);
    const { data, error } = await db()
      .from('kid_task_templates')
      .update({ member_ids })
      .eq('id', Number(req.params.id))
      .eq('family_id', me.family_id)
      .is('archived_at', null)
      .select(TEMPLATE_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Task not found');
    res.json({ task: data });
  }),
);

// ----- Rewards -----

settingsRouter.get(
  '/settings/rewards',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const { data, error } = await db()
      .from('kid_rewards')
      .select(REWARD_COLS)
      .eq('family_id', me.family_id)
      .is('archived_at', null)
      .order('min_score');
    if (error) throw error;
    res.json({ rewards: data });
  }),
);

settingsRouter.post(
  '/settings/rewards',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const title = requireText(req.body?.title, 'Reward', 80);
    const icon = String(req.body?.icon ?? 'gift');
    if (!/^[a-z0-9-]{1,30}$/.test(icon)) throw new HttpError(400, 'Choose a picture');
    const member_ids = await parseKidIds(me.family_id, req.body?.memberIds);
    const kind = req.body?.kind === 'streak' ? 'streak' : 'daily';
    const row: Record<string, unknown> = { family_id: me.family_id, title, icon, kind, member_ids };
    if (kind === 'daily') {
      const min_score = Number(req.body?.minScore);
      if (!Number.isInteger(min_score) || min_score < 1 || min_score > 100) throw new HttpError(400, 'Tasks per day must be a whole number from 1');
      row.min_score = min_score;
    } else {
      // One task done several days in a row
      const streak_days = Number(req.body?.streakDays);
      if (!Number.isInteger(streak_days) || streak_days < 2 || streak_days > 60) throw new HttpError(400, 'Days in a row must be between 2 and 60');
      const { data: task } = await db()
        .from('kid_task_templates')
        .select('id')
        .eq('id', Number(req.body?.taskId))
        .eq('family_id', me.family_id)
        .is('archived_at', null)
        .maybeSingle();
      if (!task) throw new HttpError(400, 'Choose the task');
      row.task_id = task.id;
      row.streak_days = streak_days;
    }
    const { data, error } = await db()
      .from('kid_rewards')
      .insert(row)
      .select(REWARD_COLS)
      .single();
    if (error) throw error;
    res.status(201).json({ reward: data });
  }),
);

settingsRouter.delete(
  '/settings/rewards/:id',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const { data, error } = await db()
      .from('kid_rewards')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('family_id', me.family_id)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Reward not found');
    res.json({ ok: true });
  }),
);

/** Removing a task hides it from today on; past ticks stay for the statistics. */
settingsRouter.delete(
  '/settings/kid-tasks/:id',
  handle(async (req, res) => {
    const me = requireAdmin(req);
    const { data, error } = await db()
      .from('kid_task_templates')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', Number(req.params.id))
      .eq('family_id', me.family_id)
      .is('archived_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Task not found');
    res.json({ ok: true });
  }),
);
