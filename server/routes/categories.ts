import { Router } from 'express';
import { memberOf, requireCaller } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, requireText } from '../util.js';

/** Built-in categories every family gets; families can add more by hand. The shopping list starts empty. */
export const DEFAULT_CATEGORIES: Record<'shopping' | 'calendar', readonly string[]> = {
  shopping: [],
  calendar: ['Vacation', 'Work', 'Kids'],
};
type Kind = keyof typeof DEFAULT_CATEGORIES;

const parseKind = (k: unknown): Kind => {
  if (k !== 'shopping' && k !== 'calendar') throw new HttpError(400, 'kind must be shopping or calendar');
  return k;
};

export const categoriesRouter = Router();
categoriesRouter.use('/categories', requireCaller);

/** Built-in categories first, then the family's own (each with an id so it can be removed). */
categoriesRouter.get(
  '/categories',
  handle(async (req, res) => {
    const me = memberOf(req);
    const kind = parseKind(req.query.kind);
    const { data, error } = await db().from('family_categories').select('id, name').eq('family_id', me.family_id).eq('kind', kind).order('created_at');
    if (error) throw error;
    res.json({
      categories: [...DEFAULT_CATEGORIES[kind].map((name) => ({ id: null, name })), ...(data ?? [])],
    });
  }),
);

categoriesRouter.post(
  '/categories',
  handle(async (req, res) => {
    const me = memberOf(req);
    const kind = parseKind(req.body?.kind);
    const name = requireText(req.body?.name, 'Category', 30);
    if (DEFAULT_CATEGORIES[kind].some((d) => d.toLowerCase() === name.toLowerCase())) throw new HttpError(400, `"${name}" is already a category`);
    const { data, error } = await db().from('family_categories').insert({ family_id: me.family_id, kind, name }).select('id, name').single();
    if (error?.code === '23505') throw new HttpError(400, `"${name}" is already a category`);
    if (error) throw error;
    res.status(201).json({ category: data });
  }),
);

/** Parents can remove a hand-added category (things already in it keep their label). */
categoriesRouter.delete(
  '/categories/:id',
  handle(async (req, res) => {
    const me = memberOf(req);
    if (me.role !== 'parent') throw new HttpError(403, 'Only a parent can remove categories');
    const { data, error } = await db().from('family_categories').delete().eq('id', String(req.params.id)).eq('family_id', me.family_id).select('id');
    if (error) throw error;
    if (!data?.length) throw new HttpError(404, 'Category not found');
    res.json({ ok: true });
  }),
);
