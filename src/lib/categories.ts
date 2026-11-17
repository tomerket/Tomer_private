import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type Category = { id: string | null; name: string }; // id null = built-in
export type CategoryKind = 'shopping' | 'calendar';

/** Title colors for categories: soft background + dark text of the same hue, in a fixed order. */
export const CATEGORY_COLORS = [
  { bg: '#FFE3B3', fg: '#7A4300' },
  { bg: '#D3F3E1', fg: '#0E6239' },
  { bg: '#DCEAFF', fg: '#1D4A93' },
  { bg: '#FFDCE6', fg: '#992247' },
  { bg: '#E9DEFF', fg: '#4D25BF' },
  { bg: '#D2F2F7', fg: '#0A6170' },
  { bg: '#FFDFCF', fg: '#983C17' },
  { bg: '#E7ECC4', fg: '#4F5915' },
];

/** The color follows the category's place in the family's list, so it never changes on refresh. */
export function colorFor(name: string | null | undefined, names: string[]) {
  if (!name) return { bg: '#EEEAF7', fg: '#5B5873' };
  const i = names.findIndex((n) => n.toLowerCase() === name.toLowerCase());
  const k = i >= 0 ? i : [...name].reduce((a, c) => a + c.charCodeAt(0), 0); // unknown: stable by name
  return CATEGORY_COLORS[k % CATEGORY_COLORS.length];
}

/** The family's categories of one kind: built-in ones plus the ones added by hand. */
export function useCategories(kind: CategoryKind) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api<{ categories: Category[] }>(`/categories?kind=${kind}`)
      .then((r) => setCategories(r.categories))
      .catch(() => {});
  }, [kind]);

  /** Adds a category (throws with a readable message if it can't). Returns its name. */
  const add = useCallback(
    async (name: string) => {
      const { category } = await api<{ category: Category }>('/categories', { body: { kind, name } });
      setCategories((l) => [...l, category]);
      return category.name;
    },
    [kind],
  );

  const remove = useCallback(async (id: string) => {
    await api(`/categories/${id}`, { method: 'DELETE' });
    setCategories((l) => l.filter((c) => c.id !== id));
  }, []);

  return { categories, names: categories.map((c) => c.name), add, remove };
}
