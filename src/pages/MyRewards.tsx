import { ChevronLeft, Gift, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Avatar } from '../components/Face';
import { ErrorBox } from '../components/ui';
import { api, today } from '../lib/api';
import { rewardIconUrl } from '../lib/rewardIcons';
import { useRoles, useSession } from '../lib/session';
import { addDays, PRESETS, RewardsTotals, SERIES, type KidStats } from './Dashboard';

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
  const [kidId, setKidId] = useState<string | null>(isKid ? (me?.member?.id ?? null) : (kids[0]?.id ?? null));
  const t = today();
  const [range, setRange] = useState('30');
  const [from, setFrom] = useState(addDays(t, -29));
  const [to, setTo] = useState(t);
  const [stats, setStats] = useState<KidStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!kidId && kids[0]) setKidId(kids[0].id);
  }, [kidId, kids]);

  useEffect(() => {
    if (!kidId) return;
    let stale = false;
    setError(null);
    setStats(null);
    api<{ kids: KidStats[] }>(`/stats?memberIds=${kidId}&from=${from}&to=${to}`)
      .then((s) => !stale && setStats(s.kids[0] ?? null))
      .catch((e) => !stale && setError((e as Error).message));
    return () => {
      stale = true;
    };
  }, [kidId, from, to]);

  const kid = kids.find((k) => k.id === kidId);
  const colorOf = (id: string) => SERIES[Math.max(0, kids.findIndex((k) => k.id === id)) % SERIES.length];
  const rangeText = from === to ? `${weekday(from)} ${md(from)}` : `${md(from)} to ${md(to)}`;
  const rewardById = new Map((stats?.rewards ?? []).map((r) => [r.id, r]));
  // Newest first, only days with at least one reward
  const history = (stats?.days ?? []).filter((d) => d.earned?.length).reverse();
  const totalEarned = (stats?.rewards ?? []).reduce((a, r) => a + r.earned, 0);

  return (
    <AppLayout title={isKid ? 'My Rewards' : 'Kids Rewards'} icon={<Gift className="text-sun-ink" />}>
      <Link to="/tasks" className="mb-4 inline-flex items-center gap-1 text-xl font-bold text-violet hover:underline">
        <ChevronLeft size={24} /> Family Tasks
      </Link>

      {kids.length === 0 ? (
        <p className="py-10 text-center text-xl text-muted">Add kids in Settings to see their rewards.</p>
      ) : (
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Parents choose the kid (3 per row on phones); a kid only sees their own */}
          {!isKid && kids.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
              {kids.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKidId(k.id)}
                  aria-pressed={k.id === kidId}
                  className={`flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm font-bold transition sm:gap-2 sm:pr-4 sm:text-lg ${
                    k.id === kidId ? 'bg-violet text-white shadow' : 'bg-soft text-ink hover:bg-violet-soft'
                  }`}
                >
                  <Avatar name={k.name} photoUrl={k.photoUrl} role="kid" size={30} />
                  <span className="min-w-0 truncate">{k.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-soft p-4">
            <div className="mr-auto flex items-center gap-3">
              {kid && <Avatar name={kid.name} photoUrl={kid.photoUrl} role="kid" size={52} />}
              <div>
                <div className="text-2xl font-extrabold sm:text-3xl">{isKid ? 'My rewards' : `${kid?.name ?? ''}'s rewards`}</div>
                {stats && (
                  <div className="text-muted">
                    {totalEarned} {totalEarned === 1 ? 'reward' : 'rewards'} earned, {rangeText}
                  </div>
                )}
              </div>
            </div>
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
                  <input type="date" className="input filter-box !w-44" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
                </label>
                <label>
                  <span className="label">To</span>
                  <input type="date" className="input filter-box !w-44" value={to} min={from} max={t} onChange={(e) => e.target.value && setTo(e.target.value)} />
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
              <RewardsTotals stats={[stats]} colorOf={colorOf} rangeText={rangeText} />

              <div>
                <button className="btn btn-ghost" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
                  <History size={20} /> {showHistory ? 'Hide history' : 'History'}
                </button>
              </div>

              {showHistory && (
                <section className="rounded-2xl border-2 border-line">
                  <h3 className="border-b border-line px-4 py-3 text-lg font-extrabold sm:text-xl">Reward history, {rangeText}</h3>
                  {history.length === 0 ? (
                    <p className="px-4 py-6 text-muted">No rewards earned in these dates yet.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {history.map((d) => (
                        <li key={d.day} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="shrink-0 sm:w-40">
                            <div className="font-extrabold">
                              {weekday(d.day)} {mdy(d.day)}
                            </div>
                            <div className="text-sm text-muted">
                              {d.done} of {d.total} tasks done
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {d.earned.map((id) => {
                              const r = rewardById.get(id);
                              if (!r) return null;
                              return (
                                <span key={id} className="inline-flex items-center gap-2 rounded-full bg-sun-soft py-1 pl-1 pr-3 font-bold text-sun-ink">
                                  <img src={rewardIconUrl(r.icon)} alt="" className="h-7 w-7 rounded-full object-cover" />
                                  {r.title}
                                </span>
                              );
                            })}
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
