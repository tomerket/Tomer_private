import type { Member } from './auth.js';
import { db } from './supabase.js';
import { HttpError } from './util.js';

/**
 * Sharing of calendar activities and shopping products.
 * shared_with null = the whole family; an array = only the creator plus those members
 * ([] = only the creator).
 */

/** PostgREST filter: rows this member may see (made by them, shared with everyone, or shared with them). */
export const visibleTo = (me: Member) => `created_by.eq.${me.id},shared_with.is.null,shared_with.cs.{${me.id}}`;

export function canSee(row: { created_by: string | null; shared_with: string[] | null }, me: Member) {
  return row.created_by === me.id || row.shared_with === null || row.shared_with.includes(me.id);
}

/** Parses the "Share with" choice: 'all' (whole family) or a list of member ids from the same family. */
export async function parseSharedWith(input: unknown, me: Member): Promise<string[] | null> {
  if (input === 'all' || input === null) return null;
  if (input === undefined) return []; // not chosen: only the creator
  if (!Array.isArray(input)) throw new HttpError(400, 'Choose who to share with');
  const ids = [...new Set(input.map(String))].filter((id) => id !== me.id);
  if (ids.length === 0) return [];
  const { data } = await db().from('members').select('id').eq('family_id', me.family_id).in('id', ids);
  if ((data ?? []).length !== ids.length) throw new HttpError(400, 'Share only with your own family');
  return ids;
}
