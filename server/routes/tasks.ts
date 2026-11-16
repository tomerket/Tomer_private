import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, parseDay, requireText } from '../util.js';

export const tasksRouter = Router();
tasksRouter.use(requireCaller);

/** Kids may only see/tick their own tasks; parents may for any kid in the family. */
async function kidFor(req: Request): Promise<{ me: Member; kid: Member }> {
  const me = memberOf(req);
  const kidId = String(req.params.memberId);
  if (me.role === 'kid' && me.id !== kidId) throw new HttpError(403, 'You can only see your own tasks');
  const { data: kid } = await db()
    .from('members')
    .select('id, family_id, name, role, birthday, is_admin')
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
    const [{ data: templates, error: tErr }, { data: checks, error: cErr }] = await Promise.all([
      db().from('kid_task_templates').select('id, title, icon, sort_order').eq('active', true).order('sort_order'),
      db().from('kid_task_checks').select('template_id').eq('member_id', kid.id).eq('day', day),
    ]);
    if (tErr || cErr) throw tErr ?? cErr;
    const done = new Set((checks ?? []).map((c) => c.template_id));
    res.json({ tasks: (templates ?? []).map((t) => ({ ...t, checked: done.has(t.id) })) });
  }),
);

tasksRouter.put(
  '/kids/:memberId/tasks/:templateId',
  handle(async (req, res) => {
    const { me, kid } = await kidFor(req);
    const day = parseDay(req.body?.day);
    const templateId = Number(req.params.templateId);
    if (!Number.isInteger(templateId)) throw new HttpError(400, 'Bad task id');
    const q = db().from('kid_task_checks');
    const { error } = req.body?.checked
      ? await q.upsert({ member_id: kid.id, template_id: templateId, day, checked_by: me.id })
      : await q.delete().eq('member_id', kid.id).eq('template_id', templateId).eq('day', day);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

// ---------- Parents tasks (free text) ----------

function requireParent(req: Request): Member {
  const me = memberOf(req);
  if (me.role !== 'parent') throw new HttpError(403, 'Only parents can change parents tasks');
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

const PT_COLS = 'id, text, day, done, assigned_to, created_by, created_at';

tasksRouter.get(
  '/parent-tasks',
  handle(async (req, res) => {
    const me = memberOf(req);
    let q = db().from('parent_tasks').select(PT_COLS).eq('family_id', me.family_id);
    if (req.query.filter === 'open') q = q.eq('done', false).order('day').order('created_at');
    else q = q.eq('day', parseDay(req.query.day)).order('created_at');
    const { data, error } = await q;
    if (error) throw error;
    res.json({ tasks: data });
  }),
);

tasksRouter.post(
  '/parent-tasks',
  handle(async (req, res) => {
    const me = requireParent(req);
    const row = {
      family_id: me.family_id,
      created_by: me.id,
      text: requireText(req.body?.text, 'Task', 500),
      day: parseDay(req.body?.day),
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
    if ('text' in (req.body ?? {})) patch.text = requireText(req.body.text, 'Task', 500);
    if ('done' in (req.body ?? {})) patch.done = Boolean(req.body.done);
    if ('assignedTo' in (req.body ?? {})) patch.assigned_to = await checkAssignee(me.family_id, req.body.assignedTo);
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
