"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { formatDuration } from "@/lib/imagekit";
import { signedUrl } from "@/lib/sign-client";
import { setThumbnailOffset } from "../../actions";

type Candidate = { offset: number; src: string };

export function ThumbnailPicker({
  videoId,
  duration,
  current,
  candidates,
  initialPreview,
  previewBase,
  signed,
}: {
  videoId: string;
  duration: number;
  current: number;
  candidates: Candidate[];
  initialPreview: string;
  previewBase: string;
  signed: boolean;
}) {
  const [offset, setOffset] = useState(Math.floor(current));
  const [saved, setSaved] = useState(Math.floor(current));
  const [preview, setPreview] = useState(initialPreview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (offset === saved && preview === initialPreview) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const raw = previewBase.replace("{offset}", String(offset));
      try {
        setLoading(true);
        setPreview(signed ? await signedUrl(raw) : raw);
      } catch {
        setError("Couldn’t load that frame.");
        setLoading(false);
      }
    }, 180);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the chosen offset should trigger a new preview
  }, [offset]);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setThumbnailOffset(videoId, offset);
      if (result.ok) setSaved(offset);
      else setError(result.error);
    });
  }

  const dirty = offset !== saved;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="type-heading">Thumbnail</h2>
        <span className="type-timecode text-fg-muted">Frame at {formatDuration(offset)}</span>
      </div>

      <div className="relative overflow-hidden rounded-[var(--radius-thumb)] bg-raised">
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit renders the frame at the requested width */}
        <img
          src={preview}
          alt={`Frame at ${formatDuration(offset)}`}
          width={960}
          height={540}
          onLoad={() => setLoading(false)}
          className={`aspect-video w-full object-cover transition-opacity duration-200 ${loading ? "opacity-60" : "opacity-100"}`}
        />
      </div>

      <label className="block">
        <span className="sr-only">Choose the exact second for the thumbnail</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, duration - 1)}
          step={1}
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
      </label>

      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Suggested frames">
        {candidates.map((candidate) => {
          const selected = candidate.offset === offset;
          return (
            <button
              key={candidate.offset}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Use frame at ${formatDuration(candidate.offset)}`}
              onClick={() => setOffset(candidate.offset)}
              className={`overflow-hidden rounded-[var(--radius-chip)] border-2 transition-colors ${
                selected ? "border-accent" : "border-transparent hover:border-line-strong"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small ImageKit frame */}
              <img src={candidate.src} alt="" width={160} height={90} loading="lazy" className="aspect-video w-full bg-raised object-cover" />
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className={buttonClass("strong")}
        >
          {pending ? "Saving…" : "Use this frame"}
        </button>
        {!dirty && !error && <span className="text-sm text-fg-muted">This is the current thumbnail</span>}
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}
