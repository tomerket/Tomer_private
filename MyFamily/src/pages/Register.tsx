import { Info, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { Field } from './Login';

const MIN_PASSWORD = 6;
const PASSWORD_RULE = `Password needs at least ${MIN_PASSWORD} letters or numbers`;
const DUPLICATE ='This email is already registered. Sign in on the Admin tab instead.';

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
    if (password.length < MIN_PASSWORD) return setError(PASSWORD_RULE);
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
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;

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
        <div>
          <span className="label flex items-center gap-1.5">
            Password
            <span className="group relative inline-flex" tabIndex={0} aria-label={PASSWORD_RULE}>
              <Info size={17} className="cursor-help text-violet" />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100"
              >
                {PASSWORD_RULE}
              </span>
            </span>
          </span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            title={PASSWORD_RULE}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {tooShort && <span className="mt-1 block text-sm font-semibold text-danger">{PASSWORD_RULE}</span>}
        </div>
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
