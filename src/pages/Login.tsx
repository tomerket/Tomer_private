import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BirthdayInput, isValidBirthday } from '../components/BirthdayInput';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';

type Tab = 'member' | 'admin';

export default function Login() {
  const [tab, setTab] = useState<Tab>('member');
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your family">
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
  const [form, setForm] = useState({ familyName: '', adminName: '', name: '', birthday: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidBirthday(form.birthday)) return setError('Please enter your birthday as MM-DD-YYYY');
    setBusy(true);
    try {
      await supabase.auth.signOut(); // make sure no admin session overrides the member session
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
      <Field label="Admin name">
        <input className="input" value={form.adminName} onChange={(e) => set('adminName')(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="Your name">
        <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" required />
      </Field>
      <Field label="Your birthday">
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
