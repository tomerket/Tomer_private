import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BirthdayInput, isValidBirthday } from '../components/BirthdayInput';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { IDLE_FLAG_KEY, IDLE_MINUTES, useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

type Tab = 'member' | 'admin';

/** True once if the user was just signed out for being idle. */
function takeIdleFlag(): boolean {
  try {
    const v = sessionStorage.getItem(IDLE_FLAG_KEY) === '1';
    sessionStorage.removeItem(IDLE_FLAG_KEY);
    return v;
  } catch {
    return false;
  }
}

export default function Login() {
  const [tab, setTab] = useState<Tab>('member');
  const [idle] = useState(takeIdleFlag);
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your family">
      {idle && (
        <div role="status" className="mb-5 rounded-xl border-2 border-sun bg-sun-soft px-4 py-3 font-semibold text-sun-ink">
          You were logged out after {IDLE_MINUTES} minutes without activity. Please sign in again.
        </div>
      )}
      {tab === 'member' && (
        <div className="mb-5 rounded-xl border-2 border-violet-soft bg-violet-soft/50 px-4 py-3 text-ink">
          <b>First time here?</b> The family admin needs to{' '}
          <Link to="/register" className="font-bold text-violet underline">
            register
          </Link>{' '}
          and set up the family first. After that, family members can sign in.
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-soft p-1">
        {(['member', 'admin'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2.5 text-lg font-bold transition ${tab === t ? 'bg-white text-violet shadow' : 'text-muted'}`}
          >
            {t === 'member' ? 'Family member' : 'Admin'}
          </button>
        ))}
      </div>
      {tab === 'member' ? <MemberLogin /> : <AdminLogin />}
      <p className="mt-6 text-center text-muted">
        New family?{' '}
        <Link to="/register" className="font-bold text-violet hover:underline">
          Register here
        </Link>
      </p>
    </AuthShell>
  );
}

function MemberLogin() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState({ familyName: '', parentName: '', name: '', birthday: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidBirthday(form.birthday)) return setError('Please enter your birthday as MM-DD-YYYY');
    setBusy(true);
    try {
      await supabase.auth.signOut({ scope: 'local' }); // make sure no admin session overrides the member session
      await api('/member-login', { body: form });
      await refresh();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Family name">
        <input className="input" value={form.familyName} onChange={(e) => set('familyName')(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="Parent">
        <input className="input" value={form.parentName} onChange={(e) => set('parentName')(e.target.value)} placeholder="Name of one of the parents" autoComplete="off" required />
      </Field>
      <Field label="Name">
        <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="Birthday">
        <BirthdayInput value={form.birthday} onChange={set('birthday')} />
      </Field>
      <ErrorBox message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function AdminLogin() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return setError(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
    }
    await refresh();
    setBusy(false);
    navigate('/');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl border-2 border-violet-soft bg-violet-soft/50 px-4 py-3 text-ink">
        <b>How it works:</b>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li>
            The admin{' '}
            <Link to="/register" className="font-bold text-violet underline">
              registers
            </Link>{' '}
            with email and password.
          </li>
          <li>On the first sign-in here, the admin sets up the family and adds every family member.</li>
          <li>
            From then on, each member signs in on the <b>Family member</b> tab.
          </li>
        </ol>
      </div>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Password">
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <ErrorBox message={error} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
