import { Router } from 'express';
import { clearMemberSession, requireCaller, setMemberSession, type Member } from '../auth.js';
import { db, PHOTO_BUCKET } from '../supabase.js';
import { handle, HttpError, parseBirthday, requireText } from '../util.js';

export const sessionRouter = Router();

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MIN = 15;

/** Escapes LIKE wildcards so ilike() does a case-insensitive exact match. */
const exact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function ageFrom(birthday: string): number {
  const [y, m, d] = birthday.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

/** Current caller + family. Birthdays are only returned to the admin (they act as the login secret). */
sessionRouter.get(
  '/me',
  requireCaller,
  handle(async (req, res) => {
    const caller = req.caller!;
    const me = caller.member;
    if (!me) {
      res.json({ kind: caller.kind, needsOnboarding: true, member: null, family: null, members: [] });
      return;
    }
    const isAdmin = me.is_admin && caller.kind === 'admin';
    const [{ data: family, error: fErr }, { data: members, error: mErr }] = await Promise.all([
      db().from('families').select('id, family_name, admin_name, photo_path').eq('id', me.family_id).single(),
      db().from('members').select('id, name, role, birthday, is_admin, photo_path').eq('family_id', me.family_id).order('created_at'),
    ]);
    if (fErr || mErr) throw fErr ?? mErr;

    // One batch of signed links for the family photo and every face photo
    const paths = [family.photo_path, ...(members ?? []).map((m) => m.photo_path)].filter(Boolean) as string[];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data } = await db().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
      (data ?? []).forEach((d) => d.path && d.signedUrl && urls.set(d.path, d.signedUrl));
    }
    const photoUrl = family.photo_path ? (urls.get(family.photo_path) ?? null) : null;

    res.json({
      kind: caller.kind,
      needsOnboarding: false,
      member: { id: me.id, name: me.name, role: me.role, is_admin: me.is_admin, age: ageFrom(me.birthday) },
      family: { id: family.id, family_name: family.family_name, admin_name: family.admin_name, photoUrl },
      members: (members as (Member & { photo_path: string | null })[]).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        is_admin: m.is_admin,
        age: ageFrom(m.birthday),
        photoUrl: m.photo_path ? (urls.get(m.photo_path) ?? null) : null,
        ...(isAdmin ? { birthday: m.birthday } : {}),
      })),
    });
  }),
);

/** Family member login: family name + admin name + member name + birthday. */
sessionRouter.post(
  '/member-login',
  handle(async (req, res) => {
    const familyName = requireText(req.body?.familyName, 'Family name', 60);
    // "Parent": the name of any parent in the family (tells apart families with the same family name)
    const parentName = requireText(req.body?.parentName ?? req.body?.adminName, 'Parent', 60);
    const name = requireText(req.body?.name, 'Name', 40);
    const birthday = parseBirthday(req.body?.birthday);
    const noMatch = new HttpError(401, "We couldn't find a family member with those details");

    const { data: families, error } = await db().from('families').select('id').ilike('family_name', exact(familyName));
    if (error) throw error;
    let family: { id: string } | undefined;
    if (families?.length) {
      const { data: parents } = await db()
        .from('members')
        .select('family_id')
        .in('family_id', families.map((f) => f.id))
        .eq('role', 'parent')
        .ilike('name', exact(parentName))
        .limit(1);
      family = parents?.[0] ? { id: parents[0].family_id } : undefined;
    }
    if (!family) throw noMatch;

    const since = new Date(Date.now() - FAILURE_WINDOW_MIN * 60_000).toISOString();
    const { count } = await db()
      .from('member_login_failures')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', family.id)
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_FAILURES) {
      throw new HttpError(429, `Too many tries. Please wait ${FAILURE_WINDOW_MIN} minutes and try again.`);
    }

    const { data: members } = await db()
      .from('members')
      .select('id')
      .eq('family_id', family.id)
      .ilike('name', exact(name))
      .eq('birthday', birthday)
      .limit(1);
    const member = members?.[0];
    if (!member) {
      await db().from('member_login_failures').insert({ family_id: family.id });
      throw noMatch;
    }

    setMemberSession(res, member.id);
    res.json({ ok: true });
  }),
);

sessionRouter.post('/logout', (_req, res) => {
  clearMemberSession(res);
  res.json({ ok: true });
});
