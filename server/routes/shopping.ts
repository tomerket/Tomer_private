import { Router, type Request } from 'express';
import { memberOf, requireCaller, type Member } from '../auth.js';
import { db } from '../supabase.js';
import { handle, HttpError, requireText } from '../util.js';

export const shoppingRouter = Router();
shoppingRouter.use('/shopping', requireCaller);

const COLS = 'id, category, name, bought, bought_at, created_by, created_at';
const MAX_ITEMS_PER_ADD = 30;

/** Parents can remove anything; kids only what they added. */
async function itemFor(req: Request): Promise<{ me: Member; item: { id: string; created_by: string | null } }> {
  const me = memberOf(req);
  const { data } = await db().from('shopping_items').select('id, created_by').eq('id', String(req.params.id)).eq('family_id', me.family_id).maybeSingle();
  if (!data) throw new HttpError(404, 'Product not found');
  return { me, item: data };
}

shoppingRouter.get(
  '/shopping',
  handle(async (req, res) => {
    const me = memberOf(req);
    const { data, error } = await db().from('shopping_items').select(COLS).eq('family_id', me.family_id).order('category').order('created_at');
    if (error) throw error;
    res.json({ items: data ?? [] });
  }),
);

/** Add one or more products under a category. */
shoppingRouter.post(
  '/shopping',
  handle(async (req, res) => {
    const me = memberOf(req);
    const category = requireText(req.body?.category, 'Category', 40);
    const names: unknown[] = Array.isArray(req.body?.names) ? req.body.names : [req.body?.name];
    if (names.length === 0 || names.length > MAX_ITEMS_PER_ADD) throw new HttpError(400, `Add 1 to ${MAX_ITEMS_PER_ADD} products at a time`);
    const rows = names.map((n) => ({ family_id: me.family_id, created_by: me.id, category, name: requireText(n, 'Product', 80) }));
    const { data, error } = await db().from('shopping_items').insert(rows).select(COLS);
    if (error) throw error;
    res.status(201).json({ items: data ?? [] });
  }),
);

/** Mark bought / not bought (anyone), or rename. */
shoppingRouter.patch(
  '/shopping/:id',
  handle(async (req, res) => {
    const { me, item } = await itemFor(req);
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if ('bought' in b) {
      patch.bought = Boolean(b.bought);
      patch.bought_at = patch.bought ? new Date().toISOString() : null;
    }
    if ('name' in b || 'category' in b) {
      if (me.role !== 'parent' && item.created_by !== me.id) throw new HttpError(403, 'You can only change what you added');
      if ('name' in b) patch.name = requireText(b.name, 'Product', 80);
      if ('category' in b) patch.category = requireText(b.category, 'Category', 40);
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
    const { data, error } = await db().from('shopping_items').update(patch).eq('id', item.id).eq('family_id', me.family_id).select(COLS).single();
    if (error) throw error;
    res.json({ item: data });
  }),
);

shoppingRouter.delete(
  '/shopping/:id',
  handle(async (req, res) => {
    const { me, item } = await itemFor(req);
    if (me.role !== 'parent' && item.created_by !== me.id) throw new HttpError(403, 'You can only remove what you added');
    const { error } = await db().from('shopping_items').delete().eq('id', item.id).eq('family_id', me.family_id);
    if (error) throw error;
    res.json({ ok: true });
  }),
);

/**
 * Remove many at once (parents only): ?scope=bought (only bought products) or ?scope=all,
 * optionally limited to one ?category=.
 */
shoppingRouter.delete(
  '/shopping',
  handle(async (req, res) => {
    const me = memberOf(req);
    if (me.role !== 'parent') throw new HttpError(403, 'Only a parent can clear the list');
    const scope = req.query.scope;
    if (scope !== 'bought' && scope !== 'all') throw new HttpError(400, 'scope must be bought or all');
    let q = db().from('shopping_items').delete().eq('family_id', me.family_id);
    if (scope === 'bought') q = q.eq('bought', true);
    if (typeof req.query.category === 'string' && req.query.category) q = q.eq('category', req.query.category);
    const { data, error } = await q.select('id');
    if (error) throw error;
    res.json({ removed: data?.length ?? 0 });
  }),
);
