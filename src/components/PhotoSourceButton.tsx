import { Camera, ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Camera button that offers two choices: upload a photo from the device, or take one with the
 * camera (on a phone the second opens the camera directly; on a computer it opens a file).
 */
export function PhotoSourceButton({
  onPick,
  disabled = false,
  label = 'Add a photo',
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const input = (capture: boolean) => (
    <input
      type="file"
      accept="image/*"
      {...(capture ? { capture: 'environment' as const } : {})}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onPick(f);
        e.target.value = '';
        setOpen(false);
      }}
    />
  );

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className="btn btn-ghost h-12 w-12 !p-0"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <Camera size={22} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-56 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-line">
          <label role="menuitem" className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 font-semibold hover:bg-soft">
            <ImagePlus size={20} className="text-violet" /> Upload a photo
            {input(false)}
          </label>
          <label role="menuitem" className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 font-semibold hover:bg-soft">
            <Camera size={20} className="text-violet" /> Take a photo
            {input(true)}
          </label>
        </div>
      )}
    </div>
  );
}
