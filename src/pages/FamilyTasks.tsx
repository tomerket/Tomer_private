import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useRoles, useSession } from '../lib/session';
import { taskIconUrl } from '../lib/taskIcons';

/** Big box that grows to fill its share of the page. */
function BigCard({ to, img, title, text }: { to: string; img: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="card-gradient lift group flex min-h-[180px] flex-1 items-center gap-6 overflow-hidden rounded-[28px] p-6 text-white transition hover:-translate-y-0.5 sm:gap-10 sm:p-10"
    >
      <img src={img} alt="" className="h-28 w-28 shrink-0 rounded-[20px] bg-white object-contain p-1.5 sm:h-44 sm:w-44" />
      <div className="min-w-0 flex-1">
        <div className="text-5xl font-extrabold leading-none sm:text-7xl">{title}</div>
        <div className="mt-2 text-xl font-medium text-white/90 sm:text-2xl">{text}</div>
      </div>
      <span className="shrink-0 rounded-full bg-white px-6 py-3 text-xl font-bold text-violet sm:px-8 sm:py-4 sm:text-2xl">Open</span>
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
