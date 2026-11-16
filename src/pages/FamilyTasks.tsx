import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useRoles, useSession } from '../lib/session';

/** Long horizontal card: picture · title/text · GO */
function WideCard({ to, img, title, text }: { to: string; img: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="hero-gradient group flex min-h-[150px] items-center gap-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:min-h-[170px] sm:gap-8 sm:p-8"
    >
      <img src={img} alt="" className="h-20 w-20 shrink-0 drop-shadow-lg sm:h-28 sm:w-28" />
      <div className="min-w-0 flex-1">
        <div className="text-4xl font-extrabold uppercase tracking-wide sm:text-5xl">{title}</div>
        <div className="mt-1 text-lg font-medium text-white/90 sm:text-xl">{text}</div>
      </div>
      <span className="hidden shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 text-xl font-extrabold text-ink sm:flex">
        GO <ArrowRight className="transition group-hover:translate-x-1" />
      </span>
      <ArrowRight size={32} className="shrink-0 sm:hidden" />
    </Link>
  );
}

export default function FamilyTasks() {
  const { me } = useSession();
  const { isParent } = useRoles();
  const kids = me?.members.filter((m) => m.role === 'kid').length ?? 0;
  return (
    <AppLayout title="Family Tasks" icon={<ClipboardCheck className="text-violet" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 py-2 sm:gap-10 sm:py-4">
        <WideCard
          to="/tasks/kids"
          img="/task-icons/teddy.png"
          title="Kids"
          text={
            isParent
              ? kids
                ? `Daily tasks for ${kids} ${kids === 1 ? 'kid' : 'kids'}`
                : 'Daily tasks for the kids'
              : 'My daily tasks'
          }
        />
        {/* Kids can't open the parents tasks */}
        {isParent && <WideCard to="/tasks/parents" img="/task-icons/calendar.png" title="Parents" text="Today's to-do list for the grown-ups" />}
      </div>
    </AppLayout>
  );
}
