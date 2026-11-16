import { ArrowRight, Heart } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-2xl font-extrabold tracking-wide ${light ? 'text-white' : 'text-ink'}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan to-violet text-white shadow">
        <Heart size={20} fill="currentColor" />
      </span>
      MyFamily
    </div>
  );
}

/** Centered white card on the gradient background, used for login/register/onboarding. */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8 sm:justify-center">
      <div className="mb-6">
        <Logo light />
      </div>
      <div className={`panel w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 sm:p-8`}>
        <h1 className="text-3xl font-extrabold uppercase tracking-wide">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border-2 border-danger/30 bg-danger/5 px-4 py-3 font-semibold text-danger">
      {message}
    </div>
  );
}

/** Big purple "GO" card, styled after the reference (MY PATH / TEACHER ASSIGNED). */
export function GoCard({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="hero-gradient flex flex-1 flex-col gap-4 p-6 text-white sm:p-7">
        <div className="text-white">{icon}</div>
        <div className="mt-auto">
          <div className="text-3xl font-extrabold uppercase tracking-wide sm:text-4xl">{title}</div>
          <div className="mt-1 text-lg font-medium text-white/90">{text}</div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 bg-white py-4 text-xl font-extrabold text-ink">
        GO <ArrowRight className="transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/40 border-t-white" />
    </div>
  );
}
