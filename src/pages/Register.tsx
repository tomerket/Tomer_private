import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Field } from './Login';

const DUPLICATE = 'This email is already registered. Sign in on the Admin tab instead.';

export default function Register() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    await api('/logout', { method: 'POST' }).catch(() => {}); // drop any family-member session
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setBusy(false);
    if (error) {
      if (/already registered|already exists/i.test(error.message)) return setError(DUPLICATE);
      return setError(error.message);
    }
    // Supabase hides duplicates: an existing email comes back as a user with no identities
    if (data.user && data.user.identities?.length === 0) return setError(DUPLICATE);
    if (data.session) {
      await refresh();
      navigate('/onboarding');
    } else setCheckEmail(true);
  }

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  if (checkEmail) {
    return (
      <AuthShell title="Check your email">
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck size={56} className="text-violet" />
          <p className="text-lg">
            We sent a confirmation link to <b>{email}</b>. Open it to finish creating your family.
          </p>
          <Link to="/login" className="font-bold text-violet hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your family" subtitle="You'll be the family admin">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {tooShort && <span className="mt-1 block text-sm font-semibold text-danger">At least 8 characters</span>}
        </Field>
        <Field label="Confirm password">
          <input
            className={`input ${mismatch ? 'border-danger focus:border-danger' : ''}`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            required
          />
          {mismatch && <span className="mt-1 block text-sm font-semibold text-danger">Passwords don't match. Please fix before continuing.</span>}
        </Field>
        <ErrorBox message={error} />
        <button className="btn btn-primary w-full" disabled={busy || mismatch || tooShort}>
          {busy ? 'Creating…' : 'Register'}
        </button>
      </form>
      <p className="mt-6 text-center text-muted">
        Already registered?{' '}
        <Link to="/login" className="font-bold text-violet hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
