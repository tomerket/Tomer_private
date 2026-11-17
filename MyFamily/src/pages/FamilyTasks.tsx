import { ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useRoles, useSession } from '../lib/session';
import { taskIconUrl } from '../lib/taskIcons';

/** Big box that grows to fill its share of the page. Three share the screen, so sizes step up only on tall screens. */
function BigCard({ to, img, title, text }: { to: string; img: string; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="card-gradient lift group flex min-h-[110px] flex-1 items-center gap-4 overflow-hidden rounded-[28px] p-4 text-white transition hover:-translate-y-0.5 sm:gap-8 sm:px-8 sm:py-3 [@media(min-height:900px)]:sm:px-8 [@media(min-height:900px)]:sm:py-5"
    >
      <img
        src={img}
        alt=""
        className="h-20 w-20 shrink-0 rounded-[20px] bg-white object-contain p-1.5 sm:h-24 sm:w-24 [@media(min-height:900px)]:sm:h-32 [@media(min-height:900px)]:sm:w-32"
      />
      <div className="min-w-0 flex-1">
        <div className="text-4xl font-extrabold leading-none sm:text-5xl [@media(min-height:900px)]:sm:text-6xl">{title}</div>
        <div className="mt-1.5 text-lg font-medium text-white/90 sm:text-2xl">{text}</div>
      </div>
      <span className="hidden shrink-0 rounded-full bg-white px-6 py-3 text-xl font-bold text-violet sm:inline sm:px-8 sm:text-2xl">Open</span>
    </Link>
  );
}

export default function FamilyTasks() {
  const { me } = useSession();
  const { isParent } = useRoles();
  const kids = me?.members.filter((m) => m.role === 'kid').length ?? 0;
  return (
    <AppLayout title="Family Tasks" icon={<ClipboardCheck className="text-violet" />} fill>
      <div className="flex flex-1 flex-col gap-4 sm:gap-5">
        <BigCard
          to="/tasks/kids"
          img={taskIconUrl('teddy')!}
          title="Kids"
          text={isParent ? (kids ? `Daily tasks for ${kids} ${kids === 1 ? 'kid' : 'kids'}` : 'Daily tasks for the kids') : 'My daily tasks'}
        />
        {/* Everyone: a kid sees their own rewards, parents pick a kid */}
        <BigCard to="/tasks/rewards" img="/reward-icons/gift.png" title={isParent ? 'Rewards' : 'My Rewards'} text={isParent ? "Each kid's rewards and history" : 'My rewards and history'} />
        {/* Kids can't open the parents tasks */}
        {isParent && <BigCard to="/tasks/parents" img={taskIconUrl('calendar')!} title="Parents" text="Today's to-do list for the grown-ups" />}
        {/* Dashboard: parents only, like before */}
        {isParent && <BigCard to="/tasks/dashboard" img="/reward-icons/trophy.png" title="Dashboard" text="How the kids are doing with their tasks and rewards" />}
      </div>
    </AppLayout>
  );
}
