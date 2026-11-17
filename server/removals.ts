import { db } from './supabase.js';
import { parseDay } from './util.js';

const DAY_MS = 86_400_000;
const utcDay = (offset = 0) => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);

/**
 * The family's "today" as sent by the browser (it knows the time zone). Anything missing or
 * more than a day away from the server's date falls back to the server's date.
 */
export function clientDay(input: unknown): string {
  try {
    const d = parseDay(input);
    return d >= utcDay(-1) && d <= utcDay(1) ? d : utcDay();
  } catch {
    return utcDay();
  }
}

/** A task was taken away from these kids on `day`: keep their history before it. */
export async function recordRemovals(templateId: number, kidIds: string[], day: string) {
  if (!kidIds.length) return;
  const { error } = await db()
    .from('kid_task_removals')
    .upsert(kidIds.map((member_id) => ({ template_id: templateId, member_id, removed_on: day })));
  if (error) throw error;
}

/** The task was given back to these kids: it counts again as usual. */
export async function clearRemovals(templateId: number, kidIds: string[]) {
  if (!kidIds.length) return;
  const { error } = await db().from('kid_task_removals').delete().eq('template_id', templateId).in('member_id', kidIds);
  if (error) throw error;
}

/** Which kids a task applies to, given its member_ids (null = every kid in the family). */
export async function kidsOf(familyId: string, memberIds: string[] | null): Promise<string[]> {
  if (memberIds) return memberIds;
  const { data } = await db().from('members').select('id').eq('family_id', familyId).eq('role', 'kid');
  return (data ?? []).map((k) => k.id);
}
