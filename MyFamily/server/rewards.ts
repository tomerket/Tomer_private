// Reward rules shared by the kids page and the Dashboard.
//
// daily  : earned on a day when the kid ticks at least `min_score` tasks (or all of them, if
//          the list is shorter) AND every must-do task on their list that day.
// streak : earned each time one chosen task is done `streak_days` days in a row.

export type RewardRow = {
  id: string;
  title: string;
  icon: string;
  kind: 'daily' | 'streak';
  min_score: number | null;
  task_id: number | null;
  streak_days: number | null;
  member_ids: string[] | null;
};

export const REWARD_COLS = 'id, title, icon, kind, min_score, task_id, streak_days, member_ids';
export const STREAK_LOOKBACK_DAYS = 61; // longest streak (60) + 1

const DAY_MS = 86_400_000;
const toDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const shiftDay = (iso: string, n: number) => toDay(Date.parse(iso) + n * DAY_MS);

/**
 * Days in a row the task was done, ending on `day`. If `day` itself isn't done yet the streak
 * is still alive, so it counts up to the day before.
 */
export function currentStreak(doneDays: Set<string>, day: string): number {
  let d = doneDays.has(day) ? day : shiftDay(day, -1);
  let n = 0;
  while (doneDays.has(d) && n < 366) {
    n++;
    d = shiftDay(d, -1);
  }
  return n;
}

/** How many times a run of `n` days in a row was completed on a day between `from` and `to`. */
export function streaksCompleted(doneDays: Set<string>, from: string, to: string, n: number): number {
  let run = 0;
  let count = 0;
  for (let t = Date.parse(shiftDay(from, -STREAK_LOOKBACK_DAYS)); t <= Date.parse(to); t += DAY_MS) {
    const day = toDay(t);
    run = doneDays.has(day) ? run + 1 : 0;
    if (day >= from && run > 0 && run % n === 0) count++;
  }
  return count;
}
