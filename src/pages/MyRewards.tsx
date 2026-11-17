import { ChevronLeft, Gift, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Avatar } from '../components/Face';
import { CheckDropdown } from '../components/CheckDropdown';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { rewardIconUrl } from '../lib/rewardIcons';
import { useRoles, useSession } from '../lib/session';
import { addDays, PRESETS, RewardsTotals, SERIES, type KidStats } from './Dashboard';

/** The rewards page (and its history) keeps the last 30 days. */
const HISTORY_DAYS = 30;
const md = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
const mdy = (iso: string) => `${md(iso)}/${iso.slice(0, 4)}`;
const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

/**
 * My rewards: a kid sees their own rewards (the same table as the dashboard), and with
 * "History" the list of days and which rewards were earned on each. Parents pick a kid.
 */
export default function MyRewards() {
  const { me } = useSession();
  const { isKid } = useRoles();
  const kids = useMemo(() => (me?.members ?? []).filter((m) => m.role === 'kid'), [me]);
  // Parents and the admin: one kid, several or all (null = all). A kid: only themselves.
  const [selected, setSelected] = useState<string[] | null>(null);
  const ids = isKid ? (me?.member?.id ? [me.member.id] : []) : (selected ?? kids.map((k) => k.id));
  const t = today();
  const oldest = addDays(t, -(HISTORY_DAYS - 1)); // rewards go back 30 days; each new day drops the oldest
  const [range, setRange] = useState('30');
  const [from, setFrom] = useState(addDays(t, -29));
  const [to, setTo] = useState(t);
  const [stats, setStats] = useState<KidStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (ids.length === 0) return;
    if (from < oldest) return setFrom(oldest);
    let stale = false;
    setError(null);
    api<{ kids: KidStats[] }>(`/stats?memberIds=${ids.join(',')}&from=${from}&to=${to}`)
      .then((s) => !stale && setStats(s.kids))
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), from, to]);

  const multi = (stats?.length ?? ids.length) > 1;
  const kid = !multi ? kids.find((k) => k.id === ids[0]) : undefined;
  const colorOf = (id: string) => SERIES[Math.max(0, kids.findIndex((k) => k.id === id)) % SERIES.length];
  const rangeText = from === to ? md(from) : `${md(from)}-${md(to)}`;
  const rewardById = new Map((stats ?? []).flatMap((k) => k.rewards).map((r) => [r.id, r]));
  // One row per date (newest first) with every kid who earned something that day
  const history = (stats?.[0]?.days ?? [])
    .map((d, i) => ({
      day: d.day,
      kids: (stats ?? []).map((k) => ({ id: k.id, name: k.name, ...k.days[i] })).filter((k) => k.earned?.length),
    }))
    .filter((d) => d.kids.length)
    .reverse();

  return (
    <AppLayout title={isKid ? 'My Rewards' : 'Kids Rewards'} icon={<Gift className="text-sun-ink" />}>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-xl font-bold text-violet hover:underline">
        <ChevronLeft size={24} /> Family Tasks
      </Link>

      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their rewards.</p>
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-soft p-4">
            <div className="mr-auto flex w-full items-center gap-3 sm:w-auto">
              {kid && <Avatar name={kid.name} photoUrl={kid.photoUrl} role="kid" size={52} />}
              <div>
                <div className="text-2xl font-extrabold sm:text-3xl">
                  {isKid ? 'My rewards' : kid ? `${kid.name}'s rewards` : selected === null ? "All kids' rewards" : 'Kids rewards'}
                </div>
                {/* Only the dates of the filter */}
                <div className="font-semibold text-muted">{rangeText}</div>
              </div>
            </div>
            {!isKid && kids.length > 1 && (
              <div>
                <span className="label">Kids</span>
                <CheckDropdown
                  ariaLabel="Kids"
                  className="filter-box"
                  allLabel="All kids"
                  options={kids.map((k) => ({ id: k.id, label: k.name, dot: colorOf(k.id) }))}
                  selected={selected}
                  onChange={setSelected}
                />
              </div>
            )}
            <label>
              <span className="label">Dates</span>
              <select
                className="input filter-box"
                value={range}
                onChange={(e) => {
                  const v = e.target.value;
                  setRange(v);
                  const p = PRESETS.find((x) => x.key === v);
                  if (p) {
                    setTo(t);
                    setFrom(addDays(t, -(p.days - 1)));
                  }
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Choose dates…</option>
              </select>
            </label>
            {range === 'custom' && (
              <div className="flex items-end gap-2">
                <label>
                  <span className="label">From</span>
                  <input type="date" className="input filter-box !w-44" value={from} min={oldest} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
                </label>
                <label>
                  <span className="label">To</span>
                  <input type="date" className="input filter-box !w-44" value={to} min={from < oldest ? oldest : from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
                </label>
              </div>
            )}
          </div>

          <ErrorBox message={error} />
          {!stats ? (
            !error && <div className="py-10 text-center text-lg text-muted">Loading…</div>
          ) : (
            <>
              {/* Same table as on the dashboard, for this one kid */}
              <RewardsTotals stats={stats} colorOf={colorOf} rangeText={rangeText} title={multi ? 'Rewards earned per kid' : 'Rewards earned'} datesOnly />

              <div>
                <button className="btn btn-ghost" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
                  <History size={20} /> {showHistory ? 'Hide history' : 'History'}
                </button>
              </div>

              {showHistory && (
                <section className="rounded-2xl border-2 border-line">
                  <div className="border-b border-line px-4 py-3">
                    <h3 className="text-lg font-extrabold sm:text-xl">Reward history, {rangeText}</h3>
                    <p className="text-sm text-muted">History keeps the last 30 days. Each new day, the oldest day is removed.</p>
                  </div>
                  {history.length === 0 ? (
                    <p className="px-4 py-6 text-muted">No rewards earned in these dates yet.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {history.map((d) => (
                        <li key={d.day} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                          <div className="shrink-0 font-extrabold sm:w-36 sm:pt-1">
                            {weekday(d.day)} {mdy(d.day)}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            {d.kids.map((k) => (
                              <div key={k.id} className="flex flex-wrap items-center gap-2">
                                {/* Name only when more than one kid is shown */}
                                {multi && (
                                  <span className="inline-flex items-center gap-1.5 font-extrabold">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(k.id) }} />
                                    {k.name}
                                  </span>
                                )}
                                <span className="text-sm text-muted">
                                  {k.done} of {k.total} tasks
                                </span>
                                {k.earned.map((id) => {
                                  const r = rewardById.get(id);
                                  if (!r) return null;
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-sun-soft py-0.5 pl-0.5 pr-2.5 text-sm font-bold text-sun-ink sm:gap-2 sm:py-1 sm:pl-1 sm:pr-3 sm:text-base">
                                      <img src={rewardIconUrl(r.icon)} alt="" className="h-5 w-5 rounded-full object-cover sm:h-7 sm:w-7" />
                                      {r.title}
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
