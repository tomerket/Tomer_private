import { Camera, Users } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { api } from '../lib/api';
import { resizeImage } from '../lib/image';
import { useRoles, useSession } from '../lib/session';

export default function Home() {
  const { me, refresh } = useSession();
  const { isAdmin } = useRoles();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me?.family) return null;

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

  return (
    <AppLayout title="Home" flush>
      {/* Photo fills the whole panel */}
      {me.family.photoUrl ? (
        <img
          src={me.family.photoUrl}
          alt={`The ${me.family.family_name} family`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="hero-gradient absolute inset-0 grid place-items-center text-white">
          <div className="flex flex-col items-center gap-2 opacity-90">
            <Users size={84} />
            <span className="text-xl font-bold">{isAdmin ? 'Add your family photo' : 'No family photo yet'}</span>
          </div>
        </div>
      )}

      {/* Title over the top of the photo */}
      <div className="relative bg-gradient-to-b from-black/60 via-black/25 to-transparent px-5 pb-16 pt-5 text-white sm:px-8 sm:pt-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-xl font-semibold text-white/90 sm:text-2xl">Hi {me.member?.name}!</p>
            <h1 className="text-4xl font-extrabold uppercase leading-none tracking-wide drop-shadow sm:text-6xl">
              The {me.family.family_name} Family
            </h1>
          </div>
          {isAdmin && (
            <label className="btn ml-auto shrink-0 cursor-pointer bg-white/90 px-3 py-2 text-ink shadow-lg backdrop-blur hover:bg-white">
              <Camera size={20} />
              <span className="hidden sm:inline">{busy ? 'Uploading…' : 'Change photo'}</span>
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => changePhoto(e.target.files?.[0])} />
            </label>
          )}
        </div>
        {error && <p className="mt-2 inline-block rounded-lg bg-danger px-3 py-1 font-semibold">{error}</p>}
      </div>

      {/* Spacer keeps the photo visible; ensures a tall photo area on phones */}
      <div className="min-h-[45dvh] flex-1" />

      {/* All family names on one line */}
      <div className="relative bg-gradient-to-t from-black/60 via-black/30 to-transparent px-4 pb-4 pt-12 sm:px-8 sm:pb-6">
        <div className="flex flex-nowrap gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
          {me.members.map((m) => (
            <div key={m.id} className="flex shrink-0 items-center gap-2 rounded-full bg-white/90 py-1 pl-1 pr-3 shadow backdrop-blur">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-base font-extrabold text-white ${
                  m.role === 'kid' ? 'bg-cyan' : 'bg-violet'
                }`}
              >
                {m.name[0]?.toUpperCase()}
              </span>
              <span className="font-bold text-ink">{m.name}</span>
              <span className="text-sm text-muted">{m.age}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
