import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, parseBirthday, requireText } from '../util.js';
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
      .select('id, is_admin')
      .eq('id', req.params.id)
      .eq('family_id', me.family_id)
      .maybeSingle();
    if (!target) throw new HttpError(404, 'Family member not found');
    if (target.is_admin) throw new HttpError(400, "The admin can't be removed");
    const { error } = await db().from('members').delete().eq('id', target.id).eq('family_id', me.family_id);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

// ----- Kids tasks -----

const PERIODS = ['morning', 'general', 'evening'];

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
    if (!/^[a-z0-9-]{1,30}$/.test(icon)) throw new HttpError(400, 'Choose a picture');

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
      .insert({ family_id: me.family_id, title, period, icon, sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
      .select(TEMPLATE_COLS)
      .single();
    if (error) throw error;
    res.status(201).json({ task: data });
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
