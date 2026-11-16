import { CalendarDays, ClipboardCheck, Home, LogOut, Menu, ShoppingCart, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Logo } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/tasks', label: 'Family Tasks', icon: ClipboardCheck },
];
const SOON = [
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Shopping List', icon: ShoppingCart },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me, logout } = useSession();
  const navigate = useNavigate();
  return (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <Logo />
      </div>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-3 text-lg font-bold transition ${
              isActive ? 'bg-violet text-white shadow' : 'text-ink hover:bg-violet-soft'
            }`
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
      <div className="mt-4 px-3 text-xs font-bold uppercase tracking-widest text-muted">Coming soon</div>
      {SOON.map(({ label, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 rounded-xl px-3 py-3 text-lg font-bold text-muted/60">
          <Icon size={22} />
          {label}
        </div>
      ))}

      <div className="mt-auto rounded-xl bg-soft p-3">
        <div className="text-sm text-muted">Signed in as</div>
        <div className="text-lg font-extrabold">
          {me?.member?.name}
          <span className="ml-2 rounded-full bg-violet-soft px-2 py-0.5 text-xs font-bold uppercase text-violet">
            {me?.member?.is_admin && me.kind === 'admin' ? 'Admin' : me?.member?.role}
          </span>
        </div>
        <button
          className="mt-2 flex items-center gap-2 font-bold text-violet hover:underline"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
    </nav>
  );
}

export function AppLayout({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex md:gap-4 md:p-4">
      {/* Desktop sidebar */}
      <aside className="panel hidden w-64 shrink-0 md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button className="absolute right-3 top-4 p-2" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-4 py-3 text-white md:hidden">
          <button aria-label="Open menu" className="rounded-xl bg-white/20 p-2" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <span className="text-xl font-extrabold">MyFamily</span>
        </header>
        <div className="panel mx-3 mb-3 flex flex-1 flex-col overflow-hidden md:m-0">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4 text-2xl font-extrabold sm:px-7">
            {icon}
            {title}
          </div>
          <div className="flex-1 p-4 sm:p-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
