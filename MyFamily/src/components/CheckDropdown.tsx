import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export type CheckOption = { id: string; label: string; dot?: string; icon?: ReactNode };

/**
 * A dropdown list where each option is ticked (✓) on or off, plus an "All" row.
 * `selected` null means all. With `allowNone`, every option may be unticked.
 */
export function CheckDropdown({
  options,
  selected,
  onChange,
  allLabel = 'All',
  noneLabel = 'None',
  allowNone = false,
  className = '',
  ariaLabel,
}: {
  options: CheckOption[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  allLabel?: string;
  noneLabel?: string;
  allowNone?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const isOn = (id: string) => selected === null || selected.includes(id);
  function toggle(id: string) {
    const cur = selected ?? options.map((o) => o.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    if (next.length === 0 && !allowNone) return; // keep at least one
    onChange(next.length === options.length ? null : next);
  }
  const picked = selected === null ? [] : options.filter((o) => selected.includes(o.id));
  const label = selected === null ? allLabel : picked.length === 0 ? noneLabel : picked.map((o) => o.label).join(', ');
  const box = (on: boolean) => (
    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-violet bg-violet' : 'border-line bg-white'}`}>
      {on && <Check size={16} strokeWidth={4} className="text-white" />}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center gap-2 text-left font-bold ${className}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={18} className="ml-auto shrink-0 text-muted" />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="absolute left-0 top-full z-30 mt-1 max-h-80 w-72 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-line">
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 font-bold hover:bg-soft" onClick={() => onChange(null)}>
            {box(selected === null)} {allLabel}
          </button>
          {allowNone && (
            <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 font-bold hover:bg-soft" onClick={() => onChange([])}>
              {box(selected !== null && selected.length === 0)} {noneLabel}
            </button>
          )}
          <div className="my-1 h-px bg-line" />
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={isOn(o.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold hover:bg-soft"
              onClick={() => toggle(o.id)}
            >
              {box(isOn(o.id))}
              {o.dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.dot }} />}
              {o.icon}
              <span className="min-w-0 flex-1">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
