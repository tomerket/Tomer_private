import { BarChart3, CalendarDays, ClipboardCheck, Home, LogOut, Menu, Settings, ShoppingCart, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRoles, useSession } from '../lib/session';
import { Logo } from './ui';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; show: 'all' | 'parent' | 'admin' };

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true, show: 'all' },
  { to: '/tasks', label: 'Family Tasks', icon: ClipboardCheck, show: 'all' },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, show: 'parent' },
  { to: '/settings', label: 'Settings', icon: Settings, show: 'admin' },
];
const SOON = [
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Shopping List', icon: ShoppingCart },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me, logout } = useSession();
  const { isParent, isAdmin } = useRoles();
  const navigate = useNavigate();
  const items = NAV.filter((n) => n.show === 'all' || (n.show === 'parent' && isParent) || (n.show === 'admin' && isAdmin));
  return (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <Logo />
      </div>
      {items.map(({ to, label, icon: Icon, end }) => (
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
            {isAdmin ? 'Admin' : me?.member?.role}
          </span>
        </div>
        <button
          className="mt-2 flex items-center gap-2 font-bold text-violet hover:underline"
          onClick={async () => {
            onNavigate?.();
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut size={18} /> Log out
        </button>
      </div>
    </nav>
  );
}

/** Today's date for the top-right corner, e.g. "Mon" over "11/16". */
function TodayBadge() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  return (
    <div className="ml-auto flex flex-col items-center rounded-xl bg-violet-soft px-3 py-1 leading-tight text-violet" title={now.toDateString()}>
      <span className="text-xs font-bold uppercase tracking-widest">{weekday}</span>
      <span className="text-xl font-extrabold">{md}</span>
    </div>
  );
}

export function AppLayout({
  title,
  icon,
  children,
  flush = false,
  fill = false,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  /** No inner padding / header bar, for full-bleed pages like Home. */
  flush?: boolean;
  /** Content is a flex column filling the panel height (children can use flex-1). */
  fill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-dvh md:flex md:h-dvh md:gap-4 md:p-4">
      {/* Desktop sidebar */}
      <aside className="panel hidden w-64 shrink-0 overflow-y-auto md:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white shadow-2xl">
            <button className="absolute right-3 top-4 p-2" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0">
        <header className="flex items-center gap-3 px-4 py-3 text-white md:hidden">
          <button aria-label="Open menu" className="rounded-xl bg-white/20 p-2" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <span className="text-xl font-extrabold">MyFamily</span>
        </header>
        <div className="panel mx-3 mb-3 flex flex-1 flex-col overflow-hidden md:m-0">
          {!flush && (
            <div className="flex items-center gap-3 border-b border-line px-5 py-3 text-2xl font-extrabold sm:px-7">
              {icon}
              {title}
              <TodayBadge />
            </div>
          )}
          <div
            className={
              flush ? 'relative flex flex-1 flex-col' : fill ? 'flex flex-1 flex-col overflow-y-auto p-4 sm:p-6' : 'flex-1 overflow-y-auto p-4 sm:p-7'
            }
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
