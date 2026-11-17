// Pictures for rewards: Microsoft Fluent Emoji (3D), MIT license. Files in public/reward-icons/<key>.png
export const REWARD_ICONS: { key: string; label: string }[] = [
  { key: 'gift', label: 'Gift' },
  { key: 'money', label: 'Money' },
  { key: 'dollar', label: 'Dollars' },
  { key: 'coin', label: 'Coin' },
  { key: 'candy', label: 'Candy' },
  { key: 'lollipop', label: 'Lollipop' },
  { key: 'icecream', label: 'Ice cream' },
  { key: 'chocolate', label: 'Chocolate' },
  { key: 'pizza', label: 'Pizza' },
  { key: 'game', label: 'Video game' },
  { key: 'tv', label: 'TV time' },
  { key: 'movie', label: 'Movie' },
  { key: 'toy', label: 'Toy' },
  { key: 'ball', label: 'Ball' },
  { key: 'balloon', label: 'Party' },
  { key: 'park', label: 'Fun day out' },
  { key: 'book', label: 'Book' },
  { key: 'trophy', label: 'Trophy' },
  { key: 'medal', label: 'Medal' },
  { key: 'star', label: 'Star' },
];

const KEYS = new Set(REWARD_ICONS.map((i) => i.key));
export const rewardIconUrl = (key: string | null | undefined) => `/reward-icons/${key && KEYS.has(key) ? key : 'gift'}.png`;

export type RewardKind = 'daily' | 'streak';

/** One-line description of how a reward is earned. */
export function rewardRule(r: { kind?: RewardKind; min_score?: number | null; streak_days?: number | null; task_title?: string }) {
  if (r.kind === 'streak') return `${r.task_title ?? 'A task'}, ${r.streak_days} days in a row`;
  return `${r.min_score} tasks a day, including all must-do tasks`;
}
