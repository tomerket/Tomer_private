import { Check, ChevronLeft, ChevronRight, Pencil, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/AppLayout';
import { useConfirm } from '../components/ConfirmDialog';
import { ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { colorFor, useCategories } from '../lib/categories';
import { useSession } from '../lib/session';
import { ShareChip, SharePicker, type SharedWith } from '../components/SharePicker';

/** Small outline button (not .btn, whose sizes can't be overridden): compact on phones. */
const SMALL_BTN =
  'inline-flex items-center gap-1 rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold hover:bg-violet-soft sm:gap-2 sm:px-4 sm:py-2 sm:text-base';

type Item = {
  id: string;
  category: string;
  name: string;
  bought: boolean;
  bought_at: string | null;
  shared_with: SharedWith; // null = all family, [] = only the person who added it
  created_by: string | null;
  created_at: string;
};


export default function Shopping() {
  const { me } = useSession();
  const [confirmDialog, confirm] = useConfirm();
  const cats = useCategories('shopping');
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [product, setProduct] = useState('');
  const [newCat, setNewCat] = useState<string | null>(null); // typing a new category
  const [sharedWith, setSharedWith] = useState<SharedWith>([]); // new products start as "Only me"
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null); // the product being changed
  const categoryRef = useRef<HTMLSelectElement>(null);
  const productRef = useRef<HTMLTextAreaElement>(null);
  const isParent = me?.member?.role === 'parent';
  // Everything you can see was added by you or shared with you, so you can remove it
  const canRemove = (_i: Item) => true;

  useEffect(() => {
    api<{ items: Item[] }>('/shopping')
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  // One column per category: the family's categories first, then any older ones still on the list
  const columns = useMemo(() => {
    const names = [...cats.names];
    (items ?? []).forEach((i) => names.some((n) => n.toLowerCase() === i.category.toLowerCase()) || names.push(i.category));
    return names.map((name) => ({
      name,
      id: cats.categories.find((c) => c.name === name)?.id ?? null,
      items: (items ?? []).filter((i) => i.category.toLowerCase() === name.toLowerCase()),
    }));
  }, [cats.names, cats.categories, items]);
  const allNames = columns.map((c) => c.name);
  const boughtCount = (items ?? []).filter((i) => i.bought).length;

  async function addCategory() {
    const name = (newCat ?? '').trim();
    if (!name) return setNewCat(null);
    setError(null);
    try {
      const added = await cats.add(name);
      setCategory(added);
      setNewCat(null);
      productRef.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // One product per line (commas work too): "Milk\nEggs\nBread" adds three products
    const names = product
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!category) return setError('Choose a category');
    if (names.length === 0) return setError('Write a product');
    setBusy(true);
    try {
      const r = await api<{ items: Item[] }>('/shopping', { body: { category, names, sharedWith: sharedWith ?? 'all' } });
      setItems((l) => [...(l ?? []), ...r.items]);
      // Start fresh for the next one
      setProduct('');
      setCategory('');
      categoryRef.current?.focus();
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
    if (!(await confirm({ title: cat ? `Empty the "${cat}" list?` : 'Delete the whole shopping list?', text: 'This removes every product, bought or not.', confirmLabel: 'Yes, delete' }))) return;
    removeWhere((x) => !cat || x.category === cat, `/shopping?scope=all${cat ? `&category=${encodeURIComponent(cat)}` : ''}`);
  }

  async function removeCategory(id: string, name: string) {
    if (!(await confirm({ title: `Remove the "${name}" category?`, confirmLabel: 'Yes, remove' }))) return;
    try {
      await cats.remove(id);
      if (category === name) setCategory('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AppLayout title="Shopping List" icon={<ShoppingCart className="text-violet" />}>
      {confirmDialog}
      {editing && (
        <EditItem
          item={editing}
          categories={allNames}
          isMine={editing.created_by === me?.member?.id}
          onClose={() => setEditing(null)}
          onSaved={(it) => {
            setItems((l) => l?.map((x) => (x.id === it.id ? it : x)) ?? null);
            setEditing(null);
          }}
        />
      )}
      <form onSubmit={add} className="mb-5 space-y-3 rounded-[28px] bg-soft p-4 sm:p-5">
        <div className="text-2xl font-extrabold">Add to the list</div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] xl:items-start">
          <div>
            <span className="label">Category *</span>
            {newCat === null ? (
              <div className="flex gap-2">
                <select ref={categoryRef} className="input min-w-0 flex-1" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                  <option value="">Choose…</option>
                  {allNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost shrink-0 px-3" onClick={() => setNewCat('')} title="Add a new category">
                  <Plus size={18} /> New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input min-w-0 flex-1"
                  autoFocus
                  maxLength={30}
                  placeholder="New category, e.g. Pharmacy"
                  aria-label="New category name"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategory();
                    }
                    if (e.key === 'Escape') setNewCat(null);
                  }}
                />
                <button type="button" className="btn btn-primary shrink-0 px-3" onClick={addCategory}>
                  Save
                </button>
                <button type="button" className="btn btn-ghost shrink-0 px-3" aria-label="Cancel new category" onClick={() => setNewCat(null)}>
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
          <label className="block">
            <span className="label">Products *</span>
            <textarea
              ref={productRef}
              className="input min-h-[110px] resize-y"
              maxLength={1200}
              placeholder={'One product per line, e.g.\nMilk\nEggs\nBread'}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd + Enter adds; plain Enter starts the next line
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
          </label>
          <button className="btn btn-primary xl:mt-7"disabled={busy || !category || !product.trim() || newCat !== null}>
            <Plus size={20} /> {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
        <p className="text-sm text-muted">
          {allNames.length === 0 ? 'Start with “+ New” to add your first category, e.g. Groceries.' : 'Write one product per line. Each one goes on its own line in the list.'}
        </p>
        <SharePicker value={sharedWith} onChange={setSharedWith} />
      </form>

      <ErrorBox message={error} />

      {!items ? (
        !error && <div className="py-10 text-center text-muted">Loading…</div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
            <span className="text-sm font-bold text-muted sm:text-lg">
              {items.length === 0 ? 'The list is empty. Add the first product above.' : `${items.length - boughtCount} to buy${boughtCount > 0 ? `, ${boughtCount} bought` : ''}`}
            </span>
            {items.length > 0 && (
              <div className="ml-auto flex flex-nowrap gap-1.5 whitespace-nowrap sm:gap-2">
                {boughtCount > 0 && (
                  <button className={SMALL_BTN} onClick={() => clearBought()}>
                    <Check className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" /> Remove bought
                  </button>
                )}
                <button className={`${SMALL_BTN} text-danger`} onClick={() => clearAll()}>
                  <Trash2 className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" /> <span className="sm:hidden">Delete all</span>
                  <span className="hidden sm:inline">Delete whole list</span>
                </button>
              </div>
            )}
          </div>

          <Columns count={columns.length}>
            {columns.map((col) => {
              const c = colorFor(col.name, allNames);
              const left = col.items.filter((i) => !i.bought).length;
              const anyBought = col.items.length > left;
              return (
                <section key={col.name} className="flex flex-col overflow-hidden rounded-2xl border-2 bg-white" style={{ borderColor: c.bg }}>
                  {/* Phones: name with the count under it; the column buttons show from tablet size up */}
                  <div className="flex flex-wrap items-center gap-x-1 px-2 py-1.5 sm:flex-nowrap sm:px-3 sm:py-2.5" style={{ background: c.bg, color: c.fg }}>
                    <h2 className="w-full min-w-0 break-words text-sm font-extrabold leading-tight sm:w-auto sm:flex-1 sm:text-xl">{col.name}</h2>
                    <span className="shrink-0 text-[11px] font-bold sm:text-sm">{col.items.length === 0 ? '' : left === 0 ? 'All bought' : `${left} left`}</span>
                    {anyBought && (
                      <button className="hidden rounded-lg p-1 hover:bg-white/60 sm:inline-flex" title={`Remove bought from ${col.name}`} aria-label={`Remove bought from ${col.name}`} onClick={() => clearBought(col.name)}>
                        <Check size={18} />
                      </button>
                    )}
                    {col.items.length > 0 && (
                      <button className="hidden rounded-lg p-1 hover:bg-white/60 sm:inline-flex" title={`Empty ${col.name}`} aria-label={`Empty the ${col.name} list`} onClick={() => clearAll(col.name)}>
                        <Trash2 size={18} />
                      </button>
                    )}
                    {isParent && col.id && col.items.length === 0 && (
                      <button className="hidden rounded-lg p-1 hover:bg-white/60 sm:inline-flex" title={`Remove the ${col.name} category`} aria-label={`Remove the ${col.name} category`} onClick={() => removeCategory(col.id!, col.name)}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  {col.items.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-muted sm:px-3 sm:py-4 sm:text-base">Nothing here yet</p>
                  ) : (
                    <ul className="flex flex-col">
                      {col.items.map((i) => (
                        <li key={i.id} className="flex w-full items-center gap-0.5 border-t border-line py-0.5 pl-1 pr-0.5 first:border-t-0 sm:gap-2 sm:px-2 sm:py-1">
                          <button
                            onClick={() => toggle(i)}
                            aria-pressed={i.bought}
                            aria-label={i.bought ? `${i.name}: bought. Tap to put back` : `Mark ${i.name} as bought`}
                            className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left sm:gap-2"
                          >
                            <span className="stamp stamp-bold stamp-sm h-[18px] w-[18px] sm:h-8 sm:w-8" data-on={i.bought}>
                              {i.bought && <Check size={12} strokeWidth={4} className="text-white sm:hidden" />}
                              {i.bought && <Check size={18} strokeWidth={4} className="hidden text-white sm:block" />}
                            </span>
                            {/* Hyphenate long words instead of cutting them anywhere */}
                            <span className="flex min-w-0 flex-col items-start gap-0.5">
                              <span
                                lang="en"
                                className={`min-w-0 max-w-full break-words text-[13px] font-semibold leading-tight hyphens-auto sm:text-lg ${i.bought ? 'text-muted line-through decoration-2' : 'text-ink'}`}
                              >
                                {i.name}
                              </span>
                              {/* Open products: who they're shared with ("All Family", names, or "Only …") */}
                              {!i.bought && <ShareChip shared={i.shared_with} createdBy={i.created_by} className="px-1.5 text-[10px] sm:px-2 sm:text-xs" />}
                            </span>
                          </button>
                          {/* Change and delete stacked, so the product name keeps its width */}
                          <div className="flex shrink-0 flex-col">
                            <button aria-label={`Change ${i.name}`} title="Change" className="shrink-0 rounded-lg p-0.5 text-muted hover:bg-soft hover:text-violet sm:p-1" onClick={() => setEditing(i)}>
                              <Pencil className="h-3 w-3 sm:h-[17px] sm:w-[17px]" />
                            </button>
                            {canRemove(i) && (
                              <button aria-label={`Delete ${i.name}`} title="Delete" className="shrink-0 rounded-lg p-0.5 text-muted hover:bg-soft hover:text-danger sm:p-1" onClick={() => removeOne(i)}>
                                <Trash2 className="h-3 w-3 sm:h-[17px] sm:w-[17px]" />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </Columns>
        </>
      )}
    </AppLayout>
  );
}

/** Change a product: fix its name, move it to another category, and (for the person who added it) who can see it. */
function EditItem({ item, categories, isMine, onClose, onSaved }: { item: Item; categories: string[]; isMine: boolean; onClose: () => void; onSaved: (i: Item) => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [sharedWith, setSharedWith] = useState<SharedWith>(item.shared_with);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = categories.includes(item.category) ? categories : [...categories, item.category];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Write a product');
    const body: Record<string, unknown> = {};
    if (name.trim() !== item.name) body.name = name.trim();
    if (category !== item.category) body.category = category;
    if (isMine && JSON.stringify(sharedWith) !== JSON.stringify(item.shared_with)) body.sharedWith = sharedWith ?? 'all';
    if (Object.keys(body).length === 0) return onClose();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ item: Item }>(`/shopping/${item.id}`, { method: 'PATCH', body });
      onSaved(r.item);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal
        aria-labelledby="edit-product-title"
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="panel max-h-[95dvh] w-full max-w-lg space-y-4 overflow-y-auto p-5"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-product-title" className="text-2xl font-extrabold">
            Change product
          </h2>
          <button type="button" aria-label="Close" className="p-1 text-muted" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="block">
          <span className="label">Product *</span>
          <input className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {isMine ? (
          <SharePicker value={sharedWith} onChange={setSharedWith} />
        ) : (
          <div>
            <span className="label">Share with</span>
            <ShareChip shared={item.shared_with} createdBy={item.created_by} className="px-3 py-1 text-sm" />
            <p className="mt-1 text-sm text-muted">Only the person who added it can change who sees it.</p>
          </div>
        )}
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Category columns side by side: up to 5 fit the page (fewer on small screens); more scroll
 * sideways, with a notice and arrow buttons so nobody misses them.
 */
function Columns({ count, children }: { count: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScroll({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [count]);

  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const hidden = scroll.left || scroll.right;

  return (
    <div>
      {hidden && (
        <div role="status" className="mb-2 flex items-center gap-2 rounded-2xl border-2 border-sun bg-sun-soft px-2.5 py-1.5 text-xs font-bold text-sun-ink sm:px-3 sm:py-2 sm:text-base">
          <span className="flex-1">
            {count} categories, not all fit on the screen. Scroll {scroll.right ? 'right' : 'left'} to see the rest.
          </span>
          <button className="rounded-lg bg-white p-1.5 disabled:opacity-30" aria-label="Scroll left" disabled={!scroll.left} onClick={() => by(-1)}>
            <ChevronLeft size={20} />
          </button>
          <button className="rounded-lg bg-white p-1.5 disabled:opacity-30" aria-label="Scroll right" disabled={!scroll.right} onClick={() => by(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      <div ref={ref} className="flex snap-x gap-2 overflow-x-auto pb-2 sm:gap-4">
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                className="w-[calc((100%_-_1rem)/3)] shrink-0 snap-start sm:w-[calc((100%_-_1rem)/2)] lg:w-[calc((100%_-_3rem)/4)] xl:w-[calc((100%_-_4rem)/5)]"
              >
                {child}
              </div>
            ))
          : children}
      </div>
    </div>
  );
}
