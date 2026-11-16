import { ImagePlus, Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Round avatar: the member's face photo, or their first letter on a color. */
export function Avatar({
  name,
  photoUrl,
  role,
  size = 36,
}: {
  name: string;
  photoUrl?: string | null;
  role: 'kid' | 'parent';
  size?: number;
}) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-extrabold text-white ${role === 'kid' ? 'bg-cyan' : 'bg-violet'}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

const OUT = 400; // saved face photo size (px)

/**
 * Pick an image and mark the face: drag the circle over the face and use +/- to size it.
 * Returns a square JPEG of just the face.
 */
export function FacePicker({ name, onCancel, onSave }: { name: string; onCancel: () => void; onSave: (face: Blob) => void | Promise<void> }) {
  const [src, setSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [circle, setCircle] = useState({ x: 0, y: 0, r: 60 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  function onLoad() {
    const img = imgRef.current!;
    const r = Math.min(img.clientWidth, img.clientHeight) * 0.3;
    setCircle({ x: img.clientWidth / 2, y: img.clientHeight * 0.4, r });
  }

  function clamp(c: { x: number; y: number; r: number }) {
    const img = imgRef.current!;
    const r = Math.max(20, Math.min(c.r, img.clientWidth / 2, img.clientHeight / 2));
    return { r, x: Math.max(r, Math.min(img.clientWidth - r, c.x)), y: Math.max(r, Math.min(img.clientHeight - r, c.y)) };
  }

  function point(e: React.PointerEvent) {
    const rect = imgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  async function save() {
    const img = imgRef.current!;
    const scale = img.naturalWidth / img.clientWidth;
    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    canvas.getContext('2d')!.drawImage(img, (circle.x - circle.r) * scale, (circle.y - circle.r) * scale, circle.r * 2 * scale, circle.r * 2 * scale, 0, 0, OUT, OUT);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    if (!blob) return setError("Couldn't read that photo. Please try another one.");
    setBusy(true);
    try {
      await onSave(blob);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal aria-label={`Face photo for ${name}`}>
      <div className="panel w-full max-w-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Face photo · {name}</h2>
          <button aria-label="Close" className="p-1 text-muted" onClick={onCancel}>
            <X />
          </button>
        </div>

        {!src ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-soft p-10 text-muted hover:border-violet">
            <ImagePlus size={44} className="text-violet" />
            <span className="text-lg font-bold">Choose a photo</span>
            <span>Then drag the circle onto {name}'s face</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSrc(URL.createObjectURL(f));
              }}
            />
          </label>
        ) : (
          <>
            <p className="mb-2 text-muted">Drag the circle onto the face. Use − / + to make it smaller or bigger.</p>
            <div ref={boxRef} className="relative mx-auto w-fit touch-none select-none overflow-hidden rounded-xl bg-ink">
              <img ref={imgRef} src={src} alt="" onLoad={onLoad} className="block max-h-[55vh] max-w-full" draggable={false} />
              {/* Dim everything outside the circle */}
              <div
                className="absolute cursor-move rounded-full ring-4 ring-white"
                style={{
                  left: circle.x - circle.r,
                  top: circle.y - circle.r,
                  width: circle.r * 2,
                  height: circle.r * 2,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const p = point(e);
                  drag.current = { dx: p.x - circle.x, dy: p.y - circle.y };
                }}
                onPointerMove={(e) => {
                  if (!drag.current) return;
                  const p = point(e);
                  setCircle((c) => clamp({ ...c, x: p.x - drag.current!.dx, y: p.y - drag.current!.dy }));
                }}
                onPointerUp={() => (drag.current = null)}
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <button className="btn btn-ghost px-3 py-2" aria-label="Smaller" onClick={() => setCircle((c) => clamp({ ...c, r: c.r * 0.88 }))}>
                <Minus size={20} />
              </button>
              <input
                type="range"
                aria-label="Circle size"
                min={20}
                max={Math.max(40, Math.floor(Math.min(imgRef.current?.clientWidth ?? 200, imgRef.current?.clientHeight ?? 200) / 2))}
                value={Math.round(circle.r)}
                onChange={(e) => setCircle((c) => clamp({ ...c, r: Number(e.target.value) }))}
                className="w-48 accent-violet"
              />
              <button className="btn btn-ghost px-3 py-2" aria-label="Bigger" onClick={() => setCircle((c) => clamp({ ...c, r: c.r * 1.12 }))}>
                <Plus size={20} />
              </button>
            </div>
          </>
        )}

        {error && <p className="mt-3 font-semibold text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          {src && (
            <button className="btn btn-ghost" onClick={() => setSrc(null)} disabled={busy}>
              Other photo
            </button>
          )}
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!src || busy}>
            {busy ? 'Saving…' : 'Save face'}
          </button>
        </div>
      </div>
    </div>
  );
}
