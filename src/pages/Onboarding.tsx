import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ageOf, BirthdayInput, isValidBirthday } from '../components/BirthdayInput';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { resizeImage } from '../lib/image';
import { useSession } from '../lib/session';
import { Field } from './Login';

type Role = 'kid' | 'parent';
type MemberDraft = { name: string; role: Role; birthday: string };

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [familyName, setFamilyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [adminBirthday, setAdminBirthday] = useState('');
  const [others, setOthers] = useState<MemberDraft[]>([{ name: '', role: 'kid', birthday: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function next(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!familyName.trim() || !adminName.trim()) return setError('Please fill in the family name and admin name');
    setStep(2);
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = others.filter((m) => m.name.trim() || m.birthday);
    const members = [{ name: adminName.trim(), role: 'parent' as Role, birthday: adminBirthday }, ...filled];
    for (const m of members) {
      if (!m.name.trim()) return setError('Every family member needs a name');
      if (!isValidBirthday(m.birthday)) return setError(`Check ${m.name || 'the'} birthday (MM-DD-YYYY)`);
    }
    setBusy(true);
    try {
      await api('/onboarding', { body: { familyName, adminName, members } });
      if (photo) {
        try {
          await api('/family/photo', { raw: await resizeImage(photo) });
        } catch {
          /* family is created; photo can be added from Home */
        }
      }
      await refresh();
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<MemberDraft>) =>
    setOthers((list) => list.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  if (step === 1) {
    return (
      <AuthShell title="Set up your family" subtitle="Step 1 of 2 · Family details" wide>
        <form onSubmit={next} className="space-y-5">
          <Field label="Family name">
            <input className="input" placeholder="e.g. Cohen" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
          </Field>
          <Field label="Admin name (your name)">
            <input className="input" placeholder="e.g. Dana" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
            <span className="mt-1 block text-sm text-muted">Family members use this to find your family when they sign in.</span>
          </Field>
          <div>
            <span className="label">Family photo</span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-line bg-soft p-4 text-muted transition hover:border-violet">
              {preview ? (
                <img src={preview} alt="Family preview" className="max-h-64 rounded-xl object-contain" />
              ) : (
                <>
                  <ImagePlus size={40} className="text-violet" />
                  <span className="font-bold">Tap to choose a photo</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <ErrorBox message={error} />
          <button className="btn btn-primary w-full">Next</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Who's in the family?" subtitle="Step 2 of 2 · Family members" wide>
      <form onSubmit={finish} className="space-y-4">
        <MemberRow
          label="You (admin)"
          value={{ name: adminName, role: 'parent', birthday: adminBirthday }}
          locked
          onChange={(p) => p.birthday !== undefined && setAdminBirthday(p.birthday)}
        />
        {others.map((m, i) => (
          <MemberRow
            key={i}
            label={`Member ${i + 2}`}
            value={m}
            onChange={(p) => update(i, p)}
            onRemove={() => setOthers((list) => list.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          className="btn btn-ghost w-full border-2 border-dashed border-line"
          onClick={() => setOthers((l) => [...l, { name: '', role: 'kid', birthday: '' }])}
        >
          <Plus size={20} /> Add family member
        </button>
        <ErrorBox message={error} />
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} disabled={busy}>
            Back
          </button>
          <button className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Finish'}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

function MemberRow({
  label,
  value,
  onChange,
  onRemove,
  locked = false,
}: {
  label: string;
  value: MemberDraft;
  onChange: (p: Partial<MemberDraft>) => void;
  onRemove?: () => void;
  locked?: boolean;
}) {
  const age = ageOf(value.birthday);
  return (
    <div className="rounded-2xl border-2 border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-extrabold uppercase tracking-wide text-violet">{label}</span>
        {onRemove && (
          <button type="button" aria-label="Remove member" className="p-1 text-muted hover:text-danger" onClick={onRemove}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className="input disabled:bg-soft" value={value.name} disabled={locked} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label={`Birthday${age !== null ? ` · age ${age}` : ''}`}>
          <BirthdayInput value={value.birthday} onChange={(birthday) => onChange({ birthday })} />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(['kid', 'parent'] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={locked}
            onClick={() => onChange({ role: r })}
            className={`rounded-xl border-2 py-2 font-bold capitalize transition ${
              value.role === r ? 'border-violet bg-violet-soft text-violet' : 'border-line text-muted'
            } ${locked ? 'cursor-default' : ''}`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
