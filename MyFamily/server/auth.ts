import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './supabase.js';
import { HttpError } from './util.js';

export const SESSION_COOKIE = 'mf_session';
const SESSION_DAYS = 30;

export type Member = {
  id: string;
  family_id: string;
  name: string;
  role: 'kid' | 'parent';
  birthday: string;
  is_admin: boolean;
};

/** Who is calling. `member` is null only for an admin who hasn't finished onboarding. */
export type Caller = {
  kind: 'admin' | 'member';
  userId: string | null; // Supabase auth user (admin only)
  member: Member | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    caller?: Caller;
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
  return s;
}

export function setMemberSession(res: Response, memberId: string) {
  const token = jwt.sign({ sub: memberId }, secret(), { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearMemberSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

const MEMBER_COLS = 'id, family_id, name, role, birthday, is_admin';

async function resolveCaller(req: Request): Promise<Caller | null> {
  // 1) Admin: Supabase access token in Authorization header
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const { data, error } = await db().auth.getUser(header.slice(7));
    if (error || !data.user) return null;
    const userId = data.user.id;
    const { data: fam } = await db()
      .from('families')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();
    let member: Member | null = null;
    if (fam) {
      const { data: m } = await db()
        .from('members')
        .select(MEMBER_COLS)
        .eq('family_id', fam.id)
        .eq('is_admin', true)
        .maybeSingle();
      member = (m as Member) ?? null;
    }
    return { kind: 'admin', userId, member };
  }

  // 2) Family member: signed session cookie
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, secret()) as { sub: string };
      const { data: m } = await db().from('members').select(MEMBER_COLS).eq('id', payload.sub).maybeSingle();
      if (m) return { kind: 'member', userId: null, member: m as Member };
    } catch {
      /* invalid / expired token */
    }
  }
  return null;
}

/** Requires any signed-in caller. */
export async function requireCaller(req: Request, _res: Response, next: NextFunction) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) throw new HttpError(401, 'Please sign in');
    req.caller = caller;
    next();
  } catch (e) {
    next(e);
  }
}

/** Returns the caller's member record or throws (caller must belong to a family). */
export function memberOf(req: Request): Member {
  const m = req.caller?.member;
  if (!m) throw new HttpError(403, 'Finish setting up your family first');
  return m;
}
