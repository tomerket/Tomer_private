import { Camera, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ageOf, BirthdayInput, isValidBirthday } from '../components/BirthdayInput';
import { Avatar, FacePicker } from '../components/Face';
import { AuthShell, ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { resizeImage } from '../lib/image';
import { useSession, type Me } from '../lib/session';
import { Field } from './Login';

type Role = 'kid' | 'parent';
type MemberDraft = { name: string; role: Role; birthday: string; face?: string | null }; // face: cropped JPEG data URL

// The draft is kept in sessionStorage so nothing is lost if the browser reloads the page
// (phones often do this after choosing a photo from the gallery).
const DRAFT_KEY = 'mf_onboarding_draft';
type Draft = {
  step: 1 | 2;
  familyName: string;
  adminName: string;
  adminBirthday: string;
  adminFace: string | null;
  others: MemberDraft[];
  photo: string | null; // resized JPEG as a data URL
};

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [initial] = useState(loadDraft);
  const [step, setStep] = useState<1 | 2>(initial.step ?? 1);
  const [familyName, setFamilyName] = useState(initial.familyName ?? '');
  const [adminName, setAdminName] = useState(initial.adminName ?? '');
  const [photo, setPhoto] = useState<string | null>(initial.photo ?? null);
  const [adminBirthday, setAdminBirthday] = useState(initial.adminBirthday ?? '');
  const [adminFace, setAdminFace] = useState<string | null>(initial.adminFace ?? null);
  const [others, setOthers] = useState<MemberDraft[]>(initial.others ?? [{ name: '', role: 'kid', birthday: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = photo;

  useEffect(() => {
    const draft: Draft = { step, familyName, adminName, adminBirthday, adminFace, others, photo };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, photo: null })); // photo too big to keep
      } catch {
        /* storage unavailable */
      }
    }
  }, [step, familyName, adminName, adminBirthday, adminFace, others, photo]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setPhoto(await blobToDataUrl(await resizeImage(file)));
    } catch {
      setError("We couldn't read that photo. Please try another one.");
    }
  }

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
    const members: MemberDraft[] = [{ name: adminName.trim(), role: 'parent', birthday: adminBirthday, face: adminFace }, ...filled];
    for (const m of members) {
      if (!m.name.trim()) return setError('Every family member needs a name');
      if (!isValidBirthday(m.birthday)) return setError(`Check ${m.name || 'the'} birthday (MM-DD-YYYY)`);
    }
    setBusy(true);
    try {
      await api('/onboarding', { body: { familyName, adminName, members: members.map(({ face: _f, ...m }) => m) } });
      // Face photos: upload once the members exist
      if (members.some((m) => m.face)) {
        try {
          const created = await api<Me>('/me');
          for (const m of members) {
            const id = created.members.find((x) => x.name.toLowerCase() === m.name.trim().toLowerCase())?.id;
            if (m.face && id) await api(`/settings/members/${id}/photo`, { raw: await (await fetch(m.face)).blob() });
          }
        } catch {
          /* faces can be added later in Settings */
        }
      }
      if (photo) {
        try {
          await api('/family/photo', { raw: await (await fetch(photo)).blob() });
        } catch {
          /* family is created; photo can be added from Home */
        }
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
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
      <AuthShell title="Set up your family" subtitle="Step 1 of 2: family details" wide>
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
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <ErrorBox message={error} />
          <button className="btn btn-primary w-full">Next</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Who's in the family?" subtitle="Step 2 of 2: family members" wide>
      <form onSubmit={finish} className="space-y-4">
        <MemberRow
          label="You (admin)"
          value={{ name: adminName, role: 'parent', birthday: adminBirthday, face: adminFace }}
          locked
          onChange={(p) => {
            if (p.birthday !== undefined) setAdminBirthday(p.birthday);
            if (p.face !== undefined) setAdminFace(p.face);
          }}
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
  const [picking, setPicking] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-line p-4">
      {picking && (
        <FacePicker
          name={value.name || 'this person'}
          onCancel={() => setPicking(false)}
          onSave={async (blob) => {
            onChange({ face: await blobToDataUrl(blob) });
            setPicking(false);
          }}
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-extrabold text-violet">{label}</span>
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
        <Field label={`Birthday${age !== null ? ` (age ${age})` : ''}`}>
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
      <div className="mt-3 flex items-center gap-3">
        {value.face ? <img src={value.face} alt="" className="h-12 w-12 rounded-full object-cover" /> : <Avatar name={value.name || '?'} role={value.role} size={48} />}
        <button type="button" className="btn btn-ghost py-2" onClick={() => setPicking(true)}>
          <Camera size={18} /> {value.face ? 'Change face photo' : 'Add face photo (optional)'}
        </button>
        {value.face && (
          <button type="button" className="text-sm font-semibold text-muted hover:text-danger" onClick={() => onChange({ face: null })}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
