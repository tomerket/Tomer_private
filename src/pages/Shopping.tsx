import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useConfirm } from '../components/ConfirmDialog';
import { ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

type Item = { id: string; category: string; name: string; bought: boolean; bought_at: string | null; created_by: string | null; created_at: string };

/** Ideas for the category box; families can also write their own. */
const SUGGESTED = ['Fruits & vegetables', 'Dairy & eggs', 'Meat & fish', 'Bread & bakery', 'Pantry', 'Drinks', 'Snacks', 'Frozen', 'Cleaning', 'Toiletries', 'Baby', 'Pets', 'School', 'Toys & games', 'Clothes', 'Gifts'];

export default function Shopping() {
  const { me } = useSession();
  const [confirmDialog, confirm] = useConfirm();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);
  const productRef = useRef<HTMLInputElement>(null);
  const isParent = me?.member?.role === 'parent';
  const canRemove = (i: Item) => isParent || i.created_by === me?.member?.id;

  useEffect(() => {
    api<{ items: Item[] }>('/shopping')
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  // Categories in the order they were first used
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    (items ?? []).forEach((i) => m.set(i.category, [...(m.get(i.category) ?? []), i]));
    return [...m.entries()];
  }, [items]);
  const used = groups.map(([c]) => c);
  const ideas = SUGGESTED.filter((s) => !used.some((u) => u.toLowerCase() === s.toLowerCase()));
  const boughtCount = (items ?? []).filter((i) => i.bought).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cat = category.trim();
    // "milk, eggs, bread" adds three products at once
    const names = product
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!cat) return setError('Choose or write a category');
    if (names.length === 0) return setError('Write a product');
    // Reuse the existing spelling of a category typed in another case
    const existing = used.find((u) => u.toLowerCase() === cat.toLowerCase()) ?? cat;
    setBusy(true);
    try {
      const r = await api<{ items: Item[] }>('/shopping', { body: { category: existing, names } });
      setItems((l) => [...(l ?? []), ...r.items]);
      setCategory(existing);
      setProduct('');
      productRef.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(i: Item) {
    const bought = !i.bought;
    setItems((l) => l?.map((x) => (x.id === i.id ? { ...x, bought } : x)) ?? null);
    try {
      await api(`/shopping/${i.id}`, { method: 'PATCH', body: { bought } });
    } catch (err) {
      setItems((l) => l?.map((x) => (x.id === i.id ? { ...x, bought: !bought } : x)) ?? null);
      setError((err as Error).message);
    }
  }

  /** Removes right away; puts things back if the server says no. */
  async function removeWhere(match: (i: Item) => boolean, path: string) {
    setError(null);
    const before = items;
    setItems((l) => l?.filter((x) => !match(x)) ?? null);
    try {
      await api(path, { method: 'DELETE' });
    } catch (err) {
      setItems(before);
      setError((err as Error).message);
    }
  }

  const removeOne = (i: Item) => removeWhere((x) => x.id === i.id, `/shopping/${i.id}`);

  async function clearBought(cat?: string) {
    const n = (items ?? []).filter((i) => i.bought && (!cat || i.category === cat)).length;
    if (!(await confirm({ title: `Remove ${n} bought ${n === 1 ? 'product' : 'products'}?`, text: cat ? `From ${cat}.` : 'From every category.' }))) return;
    removeWhere((x) => x.bought && (!cat || x.category === cat), `/shopping?scope=bought${cat ? `&category=${encodeURIComponent(cat)}` : ''}`);
  }

  async function clearAll(cat?: string) {
    if (!(await confirm({ title: cat ? `Delete the whole "${cat}" list?` : 'Delete the whole shopping list?', text: 'This removes every product, bought or not.', confirmLabel: 'Yes, delete' }))) return;
    removeWhere((x) => !cat || x.category === cat, `/shopping?scope=all${cat ? `&category=${encodeURIComponent(cat)}` : ''}`);
  }

  return (
    <AppLayout title="Shopping List" icon={<ShoppingCart className="text-violet" />}>
      {confirmDialog}
      <div className="mx-auto max-w-4xl">
        <form onSubmit={add} className="mb-5 space-y-3 rounded-[28px] bg-soft p-4 sm:p-5">
          <div className="text-2xl font-extrabold">Add to the list</div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:items-end">
            <label className="block">
              <span className="label">Category *</span>
              <input className="input" list="shopping-categories" maxLength={40} placeholder="Choose or write" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="shopping-categories">
                {[...used, ...ideas].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Product *</span>
              <input ref={productRef} className="input" maxLength={400} placeholder="e.g. Milk, eggs, bread" value={product} onChange={(e) => setProduct(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={busy || !category.trim() || !product.trim()}>
              <Plus size={20} /> {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          {/* Quick pick: categories already on the list first, then ideas */}
          <div className="flex flex-wrap gap-1.5">
            {[...used, ...ideas.slice(0, Math.max(0, 8 - used.length))].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(c);
                  productRef.current?.focus();
                }}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  category === c ? 'bg-violet text-white' : used.includes(c) ? 'bg-white text-ink ring-1 ring-line hover:bg-violet-soft' : 'bg-white/60 text-muted hover:bg-violet-soft'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Add several products at once with commas. Press Enter to add, then keep typing.</p>
        </form>

        <ErrorBox message={error} />

        {!items ? (
          !error && <div className="py-10 text-center text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line py-12 text-center text-xl text-muted">The list is empty. Add the first product above.</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-muted">
                {items.length - boughtCount} to buy{boughtCount > 0 ? `, ${boughtCount} bought` : ''}
              </span>
              {isParent && (
                <div className="ml-auto flex flex-wrap gap-2">
                  {boughtCount > 0 && (
                    <button className="btn btn-ghost px-4 py-2" onClick={() => clearBought()}>
                      <Check size={18} /> Remove bought
                    </button>
                  )}
                  <button className="btn btn-ghost px-4 py-2 text-danger" onClick={() => clearAll()}>
                    <Trash2 size={18} /> Delete whole list
                  </button>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {groups.map(([cat, list]) => {
                const left = list.filter((i) => !i.bought).length;
                const anyBought = list.length - left > 0;
                return (
                  <section key={cat} className="overflow-hidden rounded-2xl border-2 border-line bg-white">
                    <div className="flex items-center gap-2 bg-violet-soft px-4 py-2.5">
                      <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold text-violet">{cat}</h2>
                      <span className="text-sm font-bold text-muted">{left === 0 ? 'All bought' : `${left} left`}</span>
                      {isParent && anyBought && (
                        <button className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-violet" title={`Remove bought from ${cat}`} aria-label={`Remove bought from ${cat}`} onClick={() => clearBought(cat)}>
                          <Check size={18} />
                        </button>
                      )}
                      {isParent && (
                        <button className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-danger" title={`Delete ${cat}`} aria-label={`Delete the ${cat} list`} onClick={() => clearAll(cat)}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <ul>
                      {list.map((i) => (
                        <li key={i.id} className="flex items-center gap-3 border-t border-line px-3 py-1.5 first:border-t-0">
                          <button
                            onClick={() => toggle(i)}
                            aria-pressed={i.bought}
                            aria-label={i.bought ? `${i.name}: bought. Tap to put back` : `Mark ${i.name} as bought`}
                            className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                          >
                            <span className="stamp stamp-bold h-8 w-8" data-on={i.bought}>
                              {i.bought && <Check size={18} strokeWidth={4} className="text-white" />}
                            </span>
                            <span className={`min-w-0 break-words text-lg font-semibold ${i.bought ? 'text-muted line-through decoration-2' : 'text-ink'}`}>{i.name}</span>
                          </button>
                          {canRemove(i) && (
                            <button aria-label={`Delete ${i.name}`} title="Delete" className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-danger" onClick={() => removeOne(i)}>
                              <Trash2 size={18} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
