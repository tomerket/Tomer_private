import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { supabase } from './supabase';

export type MemberSummary = {
  id: string;
  name: string;
  role: 'kid' | 'parent';
  is_admin: boolean;
  age: number;
  birthday?: string;
};

export type Me = {
  kind: 'admin' | 'member';
  needsOnboarding: boolean;
  member: MemberSummary | null;
  family: { id: string; family_name: string; admin_name: string; photoUrl: string | null } | null;
  members: MemberSummary[];
};

type SessionState = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  // Every refresh/logout bumps this; a /me answer that arrives after a newer request is ignored.
  // This prevents an in-flight /me from "logging the user back in" right after logout.
  const seq = useRef(0);
  const lastUserId = useRef<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const data = await api<Me>('/me');
      if (mine === seq.current) setMe(data);
    } catch (e) {
      if (mine !== seq.current) return;
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else throw e;
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Only react when the signed-in admin actually changes (Supabase also re-fires SIGNED_IN on tab focus)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      if (lastUserId.current === undefined) {
        lastUserId.current = uid;
        return;
      }
      if (uid !== lastUserId.current) {
        lastUserId.current = uid;
        refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const logout = useCallback(async () => {
    seq.current++; // drop any /me still in flight
    lastUserId.current = null;
    setMe(null);
    // Clear both kinds of session; 'local' sign-out never fails on a network error
    await Promise.allSettled([
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }),
      supabase.auth.signOut({ scope: 'local' }),
    ]);
  }, []);

  return <SessionContext.Provider value={{ me, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** Convenience flags for permissions. */
export function useRoles() {
  const { me } = useSession();
  const isParent = me?.member?.role === 'parent';
  const isAdmin = me?.kind === 'admin' && Boolean(me?.member?.is_admin);
  return { isParent, isAdmin, isKid: me?.member?.role === 'kid' };
}
