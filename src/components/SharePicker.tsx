import { Lock, Users, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../lib/session';

/** null = the whole family; [] = only me; [ids] = me + those members. */
export type SharedWith = string[] | null;

/** "All Family", "Only me" / "Only Dana", or "Dana, Omer" (the creator always sees it too). */
export function shareLabel(shared: SharedWith, createdBy: string | null, myId: string | undefined, members: { id: string; name: string }[]) {
  if (shared === null) return 'All Family';
  const name = (id: string | null) => (id === myId ? 'me' : (members.find((m) => m.id === id)?.name ?? 'someone'));
  if (shared.length === 0) return `Only ${name(createdBy)}`;
  const names = shared.map((id) => (id === myId ? 'Me' : (members.find((m) => m.id === id)?.name ?? '?')));
  return createdBy === myId ? names.join(', ') : [name(createdBy) === 'me' ? 'Me' : name(createdBy), ...names].join(', ');
}

/** Small chip showing who can see an item. */
export function ShareChip({ shared, createdBy, className = '' }: { shared: SharedWith; createdBy: string | null; className?: string }) {
  const { me } = useSession();
  const label = shareLabel(shared, createdBy, me?.member?.id, me?.members ?? []);
  const Icon = shared === null ? Users : shared.length === 0 ? Lock : UserRound;
  return (
    // Phones: no icon and the text may wrap, so names fit in narrow shopping columns
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full bg-soft font-semibold leading-tight text-muted ${className}`} title={`Shared with: ${label}`}>
      <Icon className="hidden h-3 w-3 shrink-0 sm:block" aria-hidden />
      <span className="break-words sm:truncate">{label}</span>
    </span>
  );
}

/** "Share with": Only me / All family / chosen people from the family. */
export function SharePicker({ value, onChange }: { value: SharedWith; onChange: (v: SharedWith) => void }) {
  const { me } = useSession();
  const others = (me?.members ?? []).filter((m) => m.id !== me?.member?.id);
  const [choosing, setChoosing] = useState(Array.isArray(value) && value.length > 0);
  const mode = value === null ? 'all' : choosing || value.length > 0 ? 'some' : 'me';
  const pill = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition ${on ? 'bg-violet text-white' : 'bg-soft text-ink hover:bg-violet-soft'}`;

  return (
    <div>
      <span className="label">Share with</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Share with">
        <button type="button" role="radio" aria-checked={mode === 'me'} className={pill(mode === 'me')} onClick={() => (setChoosing(false), onChange([]))}>
          <Lock size={14} /> Only me
        </button>
        <button type="button" role="radio" aria-checked={mode === 'all'} className={pill(mode === 'all')} onClick={() => (setChoosing(false), onChange(null))}>
          <Users size={14} /> All family
        </button>
        {others.length > 0 && (
          <button type="button" role="radio" aria-checked={mode === 'some'} className={pill(mode === 'some')} onClick={() => (setChoosing(true), onChange(Array.isArray(value) ? value : []))}>
            <UserRound size={14} /> Choose people
          </button>
        )}
      </div>
      {mode === 'some' && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Family members to share with">
          {others.map((m) => {
            const on = Array.isArray(value) && value.includes(m.id);
            return (
              <label key={m.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? 'border-violet bg-violet-soft text-violet' : 'border-line bg-white'}`}>
                <input
                  type="checkbox"
                  className="accent-violet"
                  checked={on}
                  onChange={() => onChange(on ? (value ?? []).filter((id) => id !== m.id) : [...(value ?? []), m.id])}
                />
                {m.name}
              </label>
            );
          })}
        </div>
      )}
      <p className="mt-1 text-sm text-muted">
        {mode === 'all' ? 'Everyone in the family can see it.' : mode === 'me' ? 'Only you can see it.' : 'You and the people you tick can see it.'}
      </p>
    </div>
  );
}
