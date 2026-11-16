import { Camera, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Avatar } from '../components/Face';
import { api } from '../lib/api';
import { resizeImage } from '../lib/image';
import { useRoles, useSession } from '../lib/session';

/** Shown until the admin uploads the family's own photo (public-domain photo, see public/LICENSE-photos.md). */
const DEFAULT_PHOTO = '/default-family.jpg';

export default function Home() {
  const { me, refresh } = useSession();
  const { isAdmin } = useRoles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me?.family) return null;
  const hasPhoto = Boolean(me.family.photoUrl);

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await api('/family/photo', { raw: await resizeImage(file) });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!window.confirm('Remove the family photo? A sample photo will be shown until you add a new one.')) return;
    setError(null);
    setBusy(true);
    try {
      await api('/family/photo', { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout title="Home" flush>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-8 sm:pt-6">
        {/* Title */}
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-xl font-semibold text-muted sm:text-2xl">Hi {me.member?.name}!</p>
            <h1 className="text-4xl font-extrabold uppercase leading-none tracking-wide sm:text-6xl">The {me.family.family_name} Family</h1>
          </div>
          {isAdmin && (
            <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
              <label className="btn btn-primary cursor-pointer px-3 py-2 shadow">
                <Camera size={20} />
                <span className="hidden sm:inline">{busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Add your photo'}</span>
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => changePhoto(e.target.files?.[0])} />
              </label>
              {hasPhoto && (
                <button className="btn btn-ghost px-3 py-2 text-danger" disabled={busy} onClick={removePhoto} title="Remove photo">
                  <Trash2 size={20} />
                  <span className="hidden sm:inline">Remove photo</span>
                </button>
              )}
            </div>
          )}
        </div>
        {error && <p className="mt-2 rounded-lg bg-danger/10 px-3 py-1 font-semibold text-danger">{error}</p>}

        {/* Whole photo, never cropped: white margins fill the rest */}
        <div className="relative my-4 flex min-h-[45dvh] flex-1 items-center justify-center">
          <img
            src={me.family.photoUrl ?? DEFAULT_PHOTO}
            alt={hasPhoto ? `The ${me.family.family_name} family` : 'A happy family'}
            className="absolute inset-0 m-auto max-h-full max-w-full rounded-2xl object-contain shadow-xl"
          />
          {!hasPhoto && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-muted shadow">
              Sample photo{isAdmin ? ' · add your own family photo' : ''}
            </span>
          )}
        </div>

        {/* All family names on one line */}
        <div className="flex flex-nowrap justify-start gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:justify-center">
          {me.members.map((m) => (
            <div key={m.id} className="flex shrink-0 items-center gap-2 rounded-full bg-soft py-1 pl-1 pr-3">
              <Avatar name={m.name} photoUrl={m.photoUrl} role={m.role} size={40} />
              <span className="font-bold">{m.name}</span>
              <span className="text-sm text-muted">{m.age}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
