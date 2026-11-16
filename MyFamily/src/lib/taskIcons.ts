// Pictures for kids tasks: Microsoft Fluent Emoji (3D), MIT license.
// Files live in public/task-icons/<key>.png
export const TASK_ICONS: { key: string; label: string }[] = [
  { key: 'bed', label: 'Bed' },
  { key: 'toothbrush', label: 'Toothbrush' },
  { key: 'tooth', label: 'Tooth' },
  { key: 'tshirt', label: 'Clothes' },
  { key: 'socks', label: 'Socks' },
  { key: 'shoe', label: 'Shoes' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'milk', label: 'Milk' },
  { key: 'apple', label: 'Fruit' },
  { key: 'sandwich', label: 'Sandwich' },
  { key: 'plate', label: 'Table' },
  { key: 'backpack', label: 'Backpack' },
  { key: 'school', label: 'School' },
  { key: 'pencil', label: 'Homework' },
  { key: 'books', label: 'Books' },
  { key: 'openbook', label: 'Reading' },
  { key: 'laptop', label: 'Computer' },
  { key: 'teddy', label: 'Toys' },
  { key: 'puzzle', label: 'Puzzle' },
  { key: 'palette', label: 'Art' },
  { key: 'music', label: 'Music' },
  { key: 'ball', label: 'Sport' },
  { key: 'bike', label: 'Bike' },
  { key: 'broom', label: 'Sweep' },
  { key: 'sponge', label: 'Wash' },
  { key: 'sparkles', label: 'Tidy' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'trash', label: 'Trash' },
  { key: 'basket', label: 'Laundry' },
  { key: 'plant', label: 'Plants' },
  { key: 'dog', label: 'Dog' },
  { key: 'cat', label: 'Cat' },
  { key: 'soap', label: 'Wash hands' },
  { key: 'toilet', label: 'Toilet' },
  { key: 'shower', label: 'Shower' },
  { key: 'bathtub', label: 'Bath' },
  { key: 'lotion', label: 'Cream' },
  { key: 'droplet', label: 'Water' },
  { key: 'pill', label: 'Medicine' },
  { key: 'alarm', label: 'Wake up' },
  { key: 'sun', label: 'Sunrise' },
  { key: 'daytime', label: 'Day' },
  { key: 'pajamas', label: 'Pajamas' },
  { key: 'moon', label: 'Moon' },
  { key: 'sleeping', label: 'Sleep' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'heart', label: 'Kindness' },
  { key: 'star', label: 'Star' },
  { key: 'gift', label: 'Gift' },
];

const KEYS = new Set(TASK_ICONS.map((i) => i.key));

// Real photos (public domain / CC0, see public/LICENSE-photos.md) in public/task-photos/<key>.jpg.
// Keys without a photo fall back to the 3D picture in public/task-icons/<key>.png.
const PHOTOS = new Set([
  'alarm', 'apple', 'backpack', 'ball', 'basket', 'bed', 'bike', 'books', 'breakfast', 'broom', 'cat', 'dog',
  'droplet', 'heart', 'laptop', 'lotion', 'milk', 'music', 'openbook', 'palette', 'pencil', 'pill', 'plant',
  'plate', 'puzzle', 'sandwich', 'school', 'shoe', 'socks', 'sun', 'teddy', 'toilet', 'tooth', 'toothbrush',
  'trash', 'tshirt', 'moon', 'cleaning', 'daytime', 'pajamas',
]);

/** URL for a task picture, or null if the key isn't a known picture (e.g. an old emoji). */
export function taskIconUrl(key: string): string | null {
  if (PHOTOS.has(key)) return `/task-photos/${key}.jpg`;
  return KEYS.has(key) ? `/task-icons/${key}.png` : null;
}

export type Period = 'morning' | 'general' | 'evening';

export const PERIODS: { key: Period; label: string; icon: string }[] = [
  { key: 'morning', label: 'Morning', icon: 'sun' },
  { key: 'general', label: 'During the day', icon: 'daytime' },
  { key: 'evening', label: 'Evening', icon: 'moon' },
];
