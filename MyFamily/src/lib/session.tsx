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
  photoUrl?: string | null;
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
    try {
      localStorage.removeItem('mf_last_activity'); // so the next sign-in starts a fresh idle timer
    } catch {
      /* ignore */
    }
    // Clear both kinds of session; 'local' sign-out never fails on a network error
    await Promise.allSettled([
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }),
      supabase.auth.signOut({ scope: 'local' }),
    ]);
  }, []);

  useIdleLogout(Boolean(me), logout);

  return <SessionContext.Provider value={{ me, loading, refresh, logout }}>{children}</SessionContext.Provider>;
}

// ---------- Automatic logout after 15 minutes without activity ----------

export const IDLE_MINUTES = 15;
const IDLE_MS = IDLE_MINUTES * 60_000;
const LAST_ACTIVITY_KEY = 'mf_last_activity';
export const IDLE_FLAG_KEY = 'mf_idle_logout';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

function readLast(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeLast(t: number) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(t)); // shared by all tabs
  } catch {
    /* storage unavailable: this tab's timer still works */
  }
}

/** Logs out after IDLE_MINUTES with no mouse/keyboard/touch activity in any tab (also when reopening the app later). */
function useIdleLogout(signedIn: boolean, logout: () => Promise<void>) {
  const last = useRef(Date.now());

  useEffect(() => {
    if (!signedIn) return;
    const expire = async () => {
      try {
        sessionStorage.setItem(IDLE_FLAG_KEY, '1');
      } catch {
        /* ignore */
      }
      await logout();
    };

    // Coming back to the app after a long break
    const stored = readLast();
    if (stored && Date.now() - stored > IDLE_MS) {
      expire();
      return;
    }
    last.current = Date.now();
    writeLast(last.current);

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      last.current = now;
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        writeLast(now);
      }
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      const latest = Math.max(last.current, readLast()); // activity in another tab counts too
      if (Date.now() - latest > IDLE_MS) expire();
    }, 20_000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, [signedIn, logout]);
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
