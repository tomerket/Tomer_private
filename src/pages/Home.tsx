import { Camera, Home as HomeIcon, Users } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ErrorBox } from '../components/ui';
import { api } from '../lib/api';
import { resizeImage } from '../lib/image';
import { useSession } from '../lib/session';

export default function Home() {
  const { me, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me?.family) return null;
  const isAdmin = me.kind === 'admin' && me.member?.is_admin;

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
    <AppLayout title="Home" icon={<HomeIcon className="text-violet" />}>
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="text-lg font-semibold text-muted">Hi {me.member?.name}! 👋</p>
        <h2 className="mt-1 text-4xl font-extrabold uppercase tracking-wide sm:text-5xl">
          The {me.family.family_name} Family
        </h2>

        <div className="relative mt-6 w-full">
          {me.family.photoUrl ? (
            <img
              src={me.family.photoUrl}
              alt={`The ${me.family.family_name} family`}
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-xl ring-4 ring-violet-soft"
            />
          ) : (
            <div className="hero-gradient grid aspect-[4/3] w-full place-items-center rounded-3xl text-white shadow-xl">
              <div className="flex flex-col items-center gap-2">
                <Users size={72} />
                <span className="text-xl font-bold">{isAdmin ? 'Add your family photo' : 'No family photo yet'}</span>
              </div>
            </div>
          )}
          {isAdmin && (
            <label className="btn btn-primary absolute bottom-4 right-4 shadow-lg">
              <Camera size={20} /> {busy ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => changePhoto(e.target.files?.[0])} />
            </label>
          )}
        </div>
        <div className="mt-3 w-full">
          <ErrorBox message={error} />
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {me.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-full bg-soft py-1.5 pl-1.5 pr-4">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-lg font-extrabold text-white ${
                  m.role === 'kid' ? 'bg-cyan' : 'bg-violet'
                }`}
              >
                {m.name[0]?.toUpperCase()}
              </span>
              <span className="font-bold">{m.name}</span>
              <span className="text-sm text-muted">{m.age}</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
