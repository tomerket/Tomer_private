import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, Gift, HelpCircle, Home, LogIn, Settings, ShoppingCart, Smartphone, Smile, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useRoles } from '../lib/session';

type Section = { id: string; title: string; icon: LucideIcon; who?: string; body: ReactNode };

const SECTIONS: Section[] = [
  {
    id: 'sign-in',
    title: 'Signing in',
    icon: LogIn,
    body: (
      <>
        <p>
          <b>The family admin</b> registers once with an email and password, then sets up the family: the family name, each member (kid or
          parent) and their birthday (MM-DD-YYYY), and a family photo.
        </p>
        <p>
          <b>Everyone else</b> signs in on the <i>Family member</i> tab with four things: the family name, the name of one of the parents, their
          own name, and their birthday. No password is needed.
        </p>
        <ul>
          <li>Kids under 8 go straight to their own tasks page.</li>
          <li>After 15 minutes without using the app, it logs out by itself.</li>
          <li>After 10 wrong tries, member sign-in for that family pauses for 15 minutes.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'home',
    title: 'Home',
    icon: Home,
    body: (
      <>
        <p>The family photo, everyone's name and age, and a yellow <b>Reminders</b> bar when a calendar reminder is due. Tap the bar to open the Calendar.</p>
        <p>Any parent can change or remove the family photo with the camera button.</p>
      </>
    ),
  },
  {
    id: 'kids',
    title: 'Kids tasks',
    icon: Smile,
    body: (
      <>
        <p>Each kid's daily tasks, in three parts: Morning, During the day and Evening. Tap a task to tick it; tap again to untick it.</p>
        <ul>
          <li>
            <b>Must do</b> tasks have a red label. A reward is only earned when all of them are done.
          </li>
          <li>
            <b>Rewards</b>: each reward needs a number of tasks done in one day, plus every must-do task. Rewards start again every day. The
            Rewards button shows what is earned today and what is still missing.
          </li>
          <li>Kids can tick only their own tasks, and only today. Parents can switch between kids and fix up to 5 days back with the arrows.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'parents',
    title: 'Parents tasks',
    icon: ClipboardList,
    who: 'Parents only',
    body: (
      <>
        <p>A to-do list for the grown-ups. Each task has a subject, an optional description and picture, a start date, an optional end date, and the parent it is assigned to. Each parent has their own color.</p>
        <ul>
          <li>
            <b>Open today</b>: started and not done, plus what was finished today. <b>Due today</b>: ends today or is late. <b>All open</b>:
            everything not done (Open and In progress). <b>Done</b>: finished tasks.
          </li>
          <li>Every new task starts as <b>Open</b>. Use the status next to the title to switch between Open, In progress and Done.</li>
          <li>Tick the circle to close a task; untick it in Done to open it again.</li>
          <li>Done keeps the last 15 finished tasks. When another task is done, the oldest one is deleted.</li>
          <li>Use the pencil to change a task, or the camera to add a photo.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rewards',
    title: 'Rewards',
    icon: Gift,
    body: (
      <>
        <p>In Family Tasks, open <b>Rewards</b> (kids see <b>My Rewards</b>). It shows how many times each reward was earned in the dates you choose.</p>
        <ul>
          <li>A kid sees only their own rewards. Parents choose one kid, several, or all kids.</li>
          <li>With more than one kid, the table has a column per kid and a total.</li>
          <li><b>History</b> lists each day and the rewards earned that day (with the kid's name when several kids are shown). It keeps the last 30 days.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: BarChart3,
    who: 'Parents only',
    body: (
      <>
        <p>Open it from Family Tasks. Choose the kids and the dates at the top; every chart follows them.</p>
        <ul>
          <li>
            <b>Tasks done</b>: the share of all tasks on the kids' lists that were done.
          </li>
          <li>
            <b>Reward tiles</b>: how many times each reward was earned (at most once a day per kid).
          </li>
          <li>
            <b>Tasks done per day</b>, <b>By time of day</b> and <b>Task rate</b> (point at a bar for the task and how many times it was done).
          </li>
          <li>
            <b>Rewards earned per kid</b>: the same totals, kid by kid.
          </li>
        </ul>
        <p>A task removed for a kid or deleted in Settings still counts on the days before it was removed.</p>
      </>
    ),
  },
  {
    id: 'calendar',
    title: 'Calendar',
    icon: CalendarDays,
    body: (
      <>
        <p>A month view of the family's activities and birthdays. Tap a day to see it; double-click a day (or use the button) to add an activity.</p>
        <ul>
          <li>
            An activity has a name, a <b>category</b> (Vacation, Work, Kids, or add your own), a start date, an optional end date for trips that
            run several days, a time and a note.
          </li>
          <li>
            <b>Remind us</b>: choose a reminder date (quick buttons: same day, 1 day, 2 days or 1 week before) and time (8:00 AM unless you change
            it). From then until the activity is over it shows under Reminders on the Calendar and Home pages.
          </li>
          <li>
            <b>Next 10</b> lists the coming activities, all or by category. <b>Share</b> sends the list by WhatsApp, email and so on (on a
            computer it copies it).
          </li>
          <li>
            <b>Share with</b>: <i>Only me</i> (the default), <i>All family</i>, or <i>Choose people</i>. Each activity shows who it is shared
            with. Only the person who added it can change this.
          </li>
          <li>Everyone can add. Anyone an activity is shared with can change or delete it; only the person who added it chooses who it is shared with.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'shopping',
    title: 'Shopping list',
    icon: ShoppingCart,
    body: (
      <>
        <p>Choose a category (Groceries, Clothes, Appliances, or add your own with <b>+ New</b>), write the products one per line, then press Add.</p>
        <ul>
          <li>Each category is a column with its own color. When they don't all fit, a notice and arrows help you scroll to the rest.</li>
          <li>Tap a product after buying it to cross it out; tap again to put it back.</li>
          <li>Delete one product with its bin, remove all bought products, empty a category, or delete the whole list. Each only touches products shared with you.</li>
          <li>
            <b>Share with</b>: <i>Only me</i> (the default), <i>All family</i>, or chosen people. Products still to buy show who they are
            shared with, for example <i>All Family</i> or <i>Dana, Omer</i>.
          </li>
          <li>
            Tap the <b>pencil</b> next to a product to fix its name or move it to another category. The person who added it can also change
            who sees it there, for example from <i>Only me</i> to <i>All family</i>.
          </li>
          <li>Anyone a product is shared with can tick it, change it or delete it.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    who: 'Family admin only',
    body: (
      <ul>
        <li>
          <b>Family members</b>: add or remove members and add face photos.
        </li>
        <li>
          <b>Kids tasks</b>: add tasks with a picture (from the gallery or your own photo), choose the time of day, which kids get each task, and
          which are must-do. Removed tasks disappear from that day on.
        </li>
        <li>
          <b>Rewards</b>: add a reward with how many tasks a day it needs, a picture (or your own photo) and which kids it is for.
        </li>
      </ul>
    ),
  },
  {
    id: 'phone',
    title: 'Use it like an app on your phone',
    icon: Smartphone,
    body: (
      <ul>
        <li>
          <b>iPhone (Safari)</b>: tap Share, then <i>Add to Home Screen</i>.
        </li>
        <li>
          <b>Android (Chrome)</b>: tap the ⋮ menu, then <i>Add to Home screen</i> or <i>Install app</i>.
        </li>
      </ul>
    ),
  },
];

export default function Help() {
  const { isParent } = useRoles();
  // Kids don't see parents-only parts
  const sections = SECTIONS.filter((s) => isParent || !s.who);
  return (
    <AppLayout title="Help" icon={<HelpCircle className="text-violet" />}>
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-lg text-muted">How to use MyFamily. Tap a topic to jump to it.</p>
        <nav aria-label="Topics" className="mb-6 flex flex-wrap gap-2">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1.5 font-bold text-violet hover:bg-violet-soft">
              <s.icon size={16} /> {s.title}
            </a>
          ))}
        </nav>
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4 rounded-2xl border-2 border-line p-4 sm:p-5">
              <h2 className="mb-2 flex flex-wrap items-center gap-2 text-2xl font-extrabold">
                <s.icon className="text-violet" size={24} /> {s.title}
                {s.who && <span className="rounded-full bg-violet-soft px-2.5 py-0.5 font-sans text-sm font-bold text-violet">{s.who}</span>}
              </h2>
              <div className="space-y-2 text-lg leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{s.body}</div>
            </section>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-muted">
          <ClipboardCheck size={18} /> Family Tasks holds Kids, Parents and the Dashboard.
        </p>
      </div>
    </AppLayout>
  );
}
