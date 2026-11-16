import { Check, ChevronLeft, ChevronRight, Gift, Plus } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Style tile for the proposed "Fridge door" design. Self-contained: it does not change the
 * app's current styles. Open at /design.
 */

const T = {
  grape: '#6D3BF5',
  grapeDeep: '#4B22C9',
  sky: '#19C2E6',
  ink: '#1E1640',
  inkSoft: '#5B5378',
  mist: '#F4F1FF',
  line: '#E4DEFA',
  paper: '#FFFFFF',
  sun: '#FFB703',
  sunSoft: '#FFF3D1',
  night: '#2A1F66',
  daySoft: '#E2F6FC',
  danger: '#D93A5B',
};

const display: CSSProperties = { fontFamily: "'Baloo 2', system-ui, sans-serif" };
const body: CSSProperties = { fontFamily: "'Figtree', system-ui, sans-serif" };
const lift = '0 10px 24px -14px rgba(77, 34, 201, 0.55)';

function useFonts() {
  useEffect(() => {
    const id = 'design-tile-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Figtree:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

const TASKS = [
  { title: 'Make my bed', img: '/task-photos/bed.jpg', done: true },
  { title: 'Brush my teeth', img: '/task-photos/toothbrush.jpg', done: true },
  { title: 'Get dressed', img: '/task-icons/tshirt.png', done: true },
  { title: 'Eat breakfast', img: '/task-photos/breakfast.jpg', done: false },
  { title: 'Do my homework', img: '/task-photos/pencil.jpg', done: false },
  { title: 'Read for 20 minutes', img: '/task-photos/books.jpg', done: true },
  { title: 'Clean my room', img: '/task-photos/cleaning.jpg', done: false },
  { title: 'Help set the table/dishes', img: '/task-photos/plate.jpg', done: false },
  { title: 'Take a shower', img: '/task-icons/shower.png', done: false },
  { title: 'Put on pajamas', img: '/task-photos/pajamas.jpg', done: false },
];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="py-10" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="mb-6 max-w-2xl">
        <h2 className="text-3xl leading-tight" style={{ ...display, fontWeight: 800, color: T.ink }}>
          {title}
        </h2>
        {note && (
          <p className="mt-1 text-lg" style={{ color: T.inkSoft }}>
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** The memorable element: a tilted round "stamp" when a task is done. */
function Stamp({ on }: { on: boolean }) {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full transition-all duration-300"
      style={{
        border: `3px solid ${on ? T.grape : T.line}`,
        background: on ? T.grape : T.paper,
        transform: on ? 'rotate(-10deg) scale(1)' : 'rotate(0deg) scale(0.92)',
        boxShadow: on ? `inset 0 0 0 3px ${T.paper}` : 'none',
      }}
    >
      {on && <Check size={24} strokeWidth={4} color={T.paper} />}
    </span>
  );
}

function TaskTile({ title, img, done, onToggle }: { title: string; img: string; done: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={done}
      className="flex w-full items-center gap-3 rounded-[20px] p-2.5 pr-3 text-left transition active:scale-[0.98]"
      style={{ background: T.paper, border: `2px solid ${done ? T.grape : T.line}`, boxShadow: done ? lift : 'none' }}
    >
      <img src={img} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" style={{ opacity: done ? 0.55 : 1 }} />
      <span className="min-w-0 flex-1 text-xl leading-tight" style={{ ...display, fontWeight: 700, color: done ? T.inkSoft : T.ink }}>
        {title}
      </span>
      <Stamp on={done} />
    </button>
  );
}

/** Progress as a strip of stickers: each finished task adds its own photo. */
function StickerStrip({ tasks }: { tasks: typeof TASKS }) {
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="rounded-[28px] p-5" style={{ background: T.paper, boxShadow: lift }}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xl" style={{ ...display, fontWeight: 800, color: T.ink }}>
          Maya, 4 more for ice cream
        </span>
        <span className="text-4xl tabular-nums" style={{ ...display, fontWeight: 800, color: T.grape }}>
          {done}/{tasks.length}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tasks.map((t) =>
          t.done ? (
            <img key={t.title} src={t.img} alt={t.title} title={t.title} className="h-11 w-11 rounded-full object-cover" style={{ border: `3px solid ${T.grape}` }} />
          ) : (
            <span key={t.title} title={t.title} className="h-11 w-11 rounded-full" style={{ border: `2px dashed ${T.line}`, background: T.mist }} />
          ),
        )}
      </div>
    </div>
  );
}

function Swatch({ name, hex, use, dark = false }: { name: string; hex: string; use: string; dark?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[20px]" style={{ border: `1px solid ${T.line}`, background: T.paper }}>
      <div className="h-24 p-3" style={{ background: hex, color: dark ? T.paper : T.ink }}>
        <span className="text-xl" style={{ ...display, fontWeight: 800 }}>
          {name}
        </span>
      </div>
      <div className="px-3 py-2">
        <div className="font-semibold tabular-nums" style={{ color: T.ink }}>
          {hex}
        </div>
        <div className="text-sm" style={{ color: T.inkSoft }}>
          {use}
        </div>
      </div>
    </div>
  );
}

export default function DesignTile() {
  useFonts();
  const [tasks, setTasks] = useState(TASKS);
  const toggle = (i: number) => setTasks((l) => l.map((t, j) => (j === i ? { ...t, done: !t.done } : t)));
  const morning = tasks.slice(0, 4);

  return (
    <div className="min-h-dvh" style={{ ...body, background: T.mist, color: T.ink }}>
      {/* Hero: the "today" band — the only full gradient on a page */}
      <header className="px-4 pb-24 pt-8 sm:px-10" style={{ background: `linear-gradient(120deg, ${T.sky} 0%, ${T.grape} 55%, ${T.grapeDeep} 100%)`, color: T.paper }}>
        <div className="mx-auto max-w-5xl">
          <p className="text-lg font-semibold opacity-90">Style tile for MyFamily</p>
          <h1 className="mt-1 text-5xl leading-[0.95] sm:text-7xl" style={{ ...display, fontWeight: 800 }}>
            Fridge door
          </h1>
          <p className="mt-3 max-w-xl text-xl opacity-95">
            The family chore chart, moved from the fridge to the phone. Kids tick, stamp and collect; parents glance and move on.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-16 max-w-5xl px-4 pb-16 sm:px-10">
        {/* Live sample: sticker strip + a few tiles */}
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <StickerStrip tasks={tasks} />
          <div className="flex items-center justify-between gap-2 rounded-[28px] p-3" style={{ background: T.paper, boxShadow: lift }}>
            <button className="grid h-12 w-12 place-items-center rounded-full" style={{ background: T.mist, color: T.grape }} aria-label="Previous day">
              <ChevronLeft />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold" style={{ color: T.inkSoft }}>
                Monday
              </div>
              <div className="text-3xl tabular-nums" style={{ ...display, fontWeight: 800 }}>
                Today, 11/16
              </div>
            </div>
            <button className="grid h-12 w-12 place-items-center rounded-full" style={{ background: T.mist, color: T.grape, opacity: 0.35 }} aria-label="Next day">
              <ChevronRight />
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm" style={{ color: T.inkSoft }}>
          Try it: tap the tasks below. Each one stamps and adds its sticker to the strip.
        </p>

        <Section title="Color" note="Violet and cyan from your reference, on white. The gradient is kept for the top band and the big cards only.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch name="Grape" hex={T.grape} use="Buttons, stamps, links" dark />
            <Swatch name="Sky" hex={T.sky} use="Gradient start, kid chips" />
            <Swatch name="Ink" hex={T.ink} use="All text" dark />
            <Swatch name="Mist" hex={T.mist} use="Page background" />
            <Swatch name="Sun" hex={T.sun} use="Rewards, morning" />
            <Swatch name="Day" hex={T.daySoft} use="During the day band" />
            <Swatch name="Night" hex={T.night} use="Evening band" dark />
            <Swatch name="Alert" hex={T.danger} use="Overdue, delete" dark />
          </div>
        </Section>

        <Section title="Type" note="Baloo 2 for headings and numbers, round like fridge magnets. Figtree for everything you read.">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-[28px] p-6" style={{ background: T.paper }}>
              <div className="text-6xl leading-none" style={{ ...display, fontWeight: 800 }}>
                The Cohen Family
              </div>
              <div className="mt-4 text-3xl" style={{ ...display, fontWeight: 700 }}>
                Morning tasks
              </div>
              <div className="mt-2 text-5xl tabular-nums" style={{ ...display, fontWeight: 800, color: T.grape }}>
                9/14
              </div>
            </div>
            <div className="rounded-[28px] p-6 text-lg leading-relaxed" style={{ background: T.paper }}>
              <p className="text-xl font-semibold">Pay the electricity bill</p>
              <p className="mt-1" style={{ color: T.inkSoft }}>
                Account 1234. Pay online or call the office before Thursday. Keep the receipt in the blue folder.
              </p>
              <p className="mt-4 text-sm" style={{ color: T.inkSoft }}>
                Sentence case everywhere, no capital-letter labels. Body 18px with relaxed line height; small notes 14px.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Kids tasks" note="One band per time of day. Bigger photos, one clear stamp per task, nothing else competing.">
          <div className="space-y-4">
            <div className="rounded-[28px] p-4" style={{ background: T.sunSoft }}>
              <div className="mb-3 flex items-center gap-3">
                <img src="/task-photos/sun.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
                <span className="text-2xl" style={{ ...display, fontWeight: 800, color: '#8A5200' }}>
                  Morning
                </span>
                <span className="ml-auto text-xl tabular-nums" style={{ ...display, fontWeight: 700, color: '#8A5200' }}>
                  {morning.filter((t) => t.done).length}/{morning.length}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {morning.map((t, i) => (
                  <TaskTile key={t.title} {...t} onToggle={() => toggle(i)} />
                ))}
              </div>
            </div>
            <div className="rounded-[28px] p-4" style={{ background: T.daySoft }}>
              <div className="mb-3 flex items-center gap-3">
                <img src="/task-photos/daytime.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
                <span className="text-2xl" style={{ ...display, fontWeight: 800, color: '#0B5E7A' }}>
                  During the day
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {tasks.slice(4, 8).map((t, i) => (
                  <TaskTile key={t.title} {...t} onToggle={() => toggle(i + 4)} />
                ))}
              </div>
            </div>
            <div className="rounded-[28px] p-4" style={{ background: T.night }}>
              <div className="mb-3 flex items-center gap-3">
                <img src="/task-photos/moon.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
                <span className="text-2xl" style={{ ...display, fontWeight: 800, color: T.paper }}>
                  Evening
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {tasks.slice(8).map((t, i) => (
                  <TaskTile key={t.title} {...t} onToggle={() => toggle(i + 8)} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Controls" note="Pill-shaped choices, one strong button per screen, quiet secondary actions.">
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-full px-6 py-3 text-lg font-bold" style={{ background: T.grape, color: T.paper, boxShadow: lift }}>
              Save task
            </button>
            <button className="rounded-full px-6 py-3 text-lg font-bold" style={{ background: T.paper, color: T.grape, border: `2px solid ${T.line}` }}>
              Cancel
            </button>
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-lg font-bold" style={{ background: T.sunSoft, color: '#8A5200' }}>
              <Gift size={20} /> Rewards
            </button>
            <button className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-lg font-bold" style={{ color: T.danger }}>
              Delete
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ['Maya', true],
              ['Ben', false],
              ['Noa', false],
            ].map(([n, on]) => (
              <span
                key={n as string}
                className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-4 text-lg font-bold"
                style={{ background: on ? T.grape : T.paper, color: on ? T.paper : T.ink, border: `2px solid ${on ? T.grape : T.line}` }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full text-base" style={{ background: on ? T.paper : T.sky, color: on ? T.grape : T.paper, ...display, fontWeight: 800 }}>
                  {(n as string)[0]}
                </span>
                {n}
              </span>
            ))}
          </div>
          <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-semibold">Subject</span>
              <input
                className="w-full rounded-2xl px-4 py-3 text-lg outline-none focus:ring-4"
                style={{ border: `2px solid ${T.line}`, background: T.paper, color: T.ink, ['--tw-ring-color' as string]: '#D9CCFF' }}
                defaultValue="Pay the electricity bill"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">End date</span>
              <input type="date" className="w-full rounded-2xl px-4 py-3 text-lg" style={{ border: `2px solid ${T.line}`, background: T.paper, color: T.ink }} defaultValue="2026-11-19" />
            </label>
          </div>
        </Section>

        <Section title="Cards and rows" note="Big gradient cards only for the main choices. Everything else is a calm white row.">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { t: 'Kids', s: 'Daily tasks for 3 kids', img: '/task-photos/teddy.jpg' },
              { t: 'Parents', s: '2 tasks end today', img: '/task-icons/calendar.png' },
            ].map((c) => (
              <div
                key={c.t}
                className="flex items-center gap-4 rounded-[28px] p-5"
                style={{ background: `linear-gradient(120deg, ${T.grape}, ${T.grapeDeep})`, color: T.paper, boxShadow: lift }}
              >
                <img src={c.img} alt="" className="h-20 w-20 rounded-[20px] bg-white object-contain p-1" />
                <div>
                  <div className="text-4xl leading-none" style={{ ...display, fontWeight: 800 }}>
                    {c.t}
                  </div>
                  <div className="mt-1 text-lg opacity-90">{c.s}</div>
                </div>
                <span className="ml-auto rounded-full px-4 py-2 font-bold" style={{ background: T.paper, color: T.grape }}>
                  Open
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-start gap-4 rounded-[20px] p-4" style={{ background: T.paper, border: `2px solid ${T.line}` }}>
              <Stamp on={false} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-2xl" style={{ ...display, fontWeight: 700 }}>
                    Pay the electricity bill
                  </span>
                  <span className="rounded-full px-3 py-0.5 text-sm font-bold" style={{ background: T.sunSoft, color: '#8A5200' }}>
                    Ends today
                  </span>
                </div>
                <p className="mt-0.5" style={{ color: T.inkSoft }}>
                  Account 1234, pay online before 6pm.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: T.inkSoft }}>
                  <span>
                    <b style={{ color: T.ink }}>11/14 to 11/16</b>
                  </span>
                  <span>
                    For <b style={{ color: T.ink }}>Dana</b>
                  </span>
                  <span>Added by Avi on 11/14</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-[20px] p-4" style={{ background: T.sunSoft }}>
              <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: T.sun, color: T.paper }}>
                <Gift />
              </span>
              <div className="flex-1">
                <div className="text-xl" style={{ ...display, fontWeight: 800 }}>
                  Ice cream
                </div>
                <div style={{ color: T.inkSoft }}>Needs 10 tasks a day</div>
              </div>
              <div className="text-right">
                <div className="text-3xl tabular-nums" style={{ ...display, fontWeight: 800, color: '#8A5200' }}>
                  4 of 7
                </div>
                <div className="text-sm" style={{ color: T.inkSoft }}>
                  days earned
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="What changes, and what stays" note="Nothing in the app changes until you approve this.">
          <ul className="max-w-2xl space-y-2 text-lg">
            {[
              'Stays: your violet and cyan, white surfaces, real task photos, the morning / day / evening bands.',
              'New: Baloo 2 + Figtree fonts, sentence-case headings instead of capital letters.',
              'New: progress as a sticker strip of the tasks already done, and a tilted stamp when a task is ticked.',
              'New: lavender page background with the gradient only in the top band and the big Kids / Parents cards.',
              'New: rounder pill buttons and chips, softer violet shadow only on the main items.',
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <Plus size={20} className="mt-1 shrink-0" color={T.grape} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
