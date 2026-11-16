import { Heart } from 'lucide-react';
import type { ReactNode } from 'react';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-3xl font-extrabold leading-none ${light ? 'text-white' : 'text-ink'}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${light ? 'bg-white text-violet' : 'hero-gradient text-white'}`}>
        <Heart size={22} fill="currentColor" />
      </span>
      MyFamily
    </div>
  );
}

/** Sign-in / register / setup: gradient top band with the white card overlapping it. */
export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-dvh">
      <div className="hero-gradient px-4 pb-28 pt-8 sm:pt-12">
        <div className="mx-auto flex justify-center">
          <Logo light />
        </div>
      </div>
      <div className={`panel relative mx-4 -mt-20 mb-10 p-6 sm:mx-auto sm:p-8 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <h1 className="text-4xl font-extrabold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-lg text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-2xl border-2 border-danger/30 bg-danger/5 px-4 py-3 font-semibold text-danger">
      {message}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-10">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-soft border-t-violet" />
    </div>
  );
}
