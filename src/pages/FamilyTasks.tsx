import { ClipboardCheck, ClipboardList, Smile } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { GoCard } from '../components/ui';
import { useSession } from '../lib/session';

export default function FamilyTasks() {
  const { me } = useSession();
  const kids = me?.members.filter((m) => m.role === 'kid').length ?? 0;
  return (
    <AppLayout title="Family Tasks" icon={<ClipboardCheck className="text-violet" />}>
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
        <GoCard
          to="/tasks/kids"
          icon={<Smile size={64} strokeWidth={2.2} />}
          title="Kids"
          text={kids ? `Daily tasks for ${kids} ${kids === 1 ? 'kid' : 'kids'}` : 'Daily tasks for the kids'}
        />
        <GoCard
          to="/tasks/parents"
          icon={<ClipboardList size={64} strokeWidth={2.2} />}
          title="Parents"
          text="Today's to-do list for the grown-ups"
        />
      </div>
    </AppLayout>
  );
}
