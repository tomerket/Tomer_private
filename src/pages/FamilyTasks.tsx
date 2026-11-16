import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useRoles, useSession } from '../lib/session';
import { taskIconUrl } from '../lib/taskIcons';

/** Big box that grows to fill its share of the page. */
function BigCard({ to, img, title, text }: { to: string; img: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="hero-gradient group flex min-h-[180px] flex-1 items-center gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl sm:gap-10 sm:p-10"
    >
      <img src={img} alt="" className="h-28 w-28 shrink-0 rounded-2xl bg-white object-contain p-2 shadow-lg sm:h-44 sm:w-44" />
      <div className="min-w-0 flex-1">
        <div className="text-5xl font-extrabold uppercase tracking-wide sm:text-7xl">{title}</div>
        <div className="mt-2 text-xl font-medium text-white/90 sm:text-2xl">{text}</div>
      </div>
      <span className="hidden shrink-0 items-center gap-2 rounded-2xl bg-white px-8 py-4 text-2xl font-extrabold text-ink sm:flex">
        GO <ArrowRight className="transition group-hover:translate-x-1" />
      </span>
      <ArrowRight size={36} className="shrink-0 sm:hidden" />
    </Link>
  );
}

export default function FamilyTasks() {
  const { me } = useSession();
  const { isParent } = useRoles();
  const kids = me?.members.filter((m) => m.role === 'kid').length ?? 0;
  return (
    <AppLayout title="Family Tasks" icon={<ClipboardCheck className="text-violet" />} fill>
      <div className="flex flex-1 flex-col gap-6 sm:gap-8">
        <BigCard
          to="/tasks/kids"
          img={taskIconUrl('teddy')!}
          title="Kids"
          text={isParent ? (kids ? `Daily tasks for ${kids} ${kids === 1 ? 'kid' : 'kids'}` : 'Daily tasks for the kids') : 'My daily tasks'}
        />
        {/* Kids can't open the parents tasks */}
        {isParent && <BigCard to="/tasks/parents" img={taskIconUrl('calendar')!} title="Parents" text="Today's to-do list for the grown-ups" />}
      </div>
    </AppLayout>
  );
}
