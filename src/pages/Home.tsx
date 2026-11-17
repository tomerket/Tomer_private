import { Bell, Camera, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useConfirm } from '../components/ConfirmDialog';
import { Avatar } from '../components/Face';
import { api, today } from '../lib/api';
import { niceDay, niceTime, nowHM, whenText, type CalEvent } from './Calendar';
import { resizeImage } from '../lib/image';
import { useRoles, useSession } from '../lib/session';

/** Calendar reminders that are due: a small strip linking to the Calendar. Hidden when there are none. */
function HomeReminders() {
  const [items, setItems] = useState<CalEvent[]>([]);
  const t = today();
  useEffect(() => {
    api<{ reminders: CalEvent[] }>(`/calendar?from=${t}&to=${t}&today=${t}&now=${nowHM()}`)
      .then((r) => setItems(r.reminders))
      .catch(() => {});
  }, [t]);
  if (items.length === 0) return null;
  return (
    <Link to="/calendar" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 border-sun bg-sun-soft px-4 py-2 hover:ring-2 hover:ring-sun">
      <span className="inline-flex items-center gap-1.5 font-extrabold text-sun-ink">
        <Bell size={20} /> Reminders
      </span>
      {items.slice(0, 3).map((r) => (
        <span key={r.id} className="font-bold text-ink">
          {r.title}{' '}
          <span className="font-semibold text-muted">
            ({r.end_day ? whenText(r) : niceDay(r.day, t)}
            {r.time ? `, ${niceTime(r.time)}` : ''})
          </span>
        </span>
      ))}
      {items.length > 3 && <span className="font-bold text-muted">+{items.length - 3} more</span>}
    </Link>
  );
}

/** Shown until the admin uploads the family's own photo (public-domain photo, see public/LICENSE-photos.md). */
const DEFAULT_PHOTO = '/default-family.jpg';

export default function Home() {
  const { me, refresh } = useSession();
  const { isAdmin } = useRoles();
  const [busy, setBusy] = useState(false);
  const [confirmDialog, confirm] = useConfirm();
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
    if (!(await confirm({ title: 'Remove the family photo?', text: 'A sample picture is shown until you add a new one.' }))) return;
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
      {confirmDialog}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-8 sm:pt-6">
        {/* Title */}
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="text-xl font-semibold text-muted sm:text-2xl">Hi {me.member?.name}!</p>
            <h1 className="text-4xl font-extrabold leading-none tracking-wide sm:text-6xl">The {me.family.family_name} Family</h1>
          </div>
          {isAdmin && (
            <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
              <label className="btn btn-primary cursor-pointer px-3 py-2 shadow">
                <Camera size={20} />
                <span className="hidden sm:inline">{busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Add your photo'}</span>
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => changePhoto(e.target.files?.[0])} />
              </label>
              {hasPhoto && (
                <button className="btn btn-ghost px-3 py-2 text-danger" disabled={busy} onClick={removePhoto} title="Remove photo" aria-label="Remove photo">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          )}
        </div>
        {error && <p className="mt-2 rounded-lg bg-danger/10 px-3 py-1 font-semibold text-danger">{error}</p>}
        <HomeReminders />

        {/* Whole photo, never cropped: white margins fill the rest */}
        <div className="relative my-4 flex min-h-[45dvh] flex-1 items-center justify-center">
          <img
            src={me.family.photoUrl ?? DEFAULT_PHOTO}
            alt={hasPhoto ? `The ${me.family.family_name} family` : 'A happy family'}
            className="absolute inset-0 m-auto max-h-full max-w-full rounded-2xl object-contain shadow-xl"
          />
          {!hasPhoto && (
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-muted shadow">
              {isAdmin ? 'Sample photo. Add your own family photo above.' : 'Sample photo'}
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
