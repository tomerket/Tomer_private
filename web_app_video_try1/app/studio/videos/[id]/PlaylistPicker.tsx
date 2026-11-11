"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setVideoPlaylists } from "../../actions";

export function PlaylistPicker({
  videoId,
  playlists,
  selected,
}: {
  videoId: string;
  playlists: { id: string; title: string }[];
  selected: string[];
}) {
  const [chosen, setChosen] = useState(new Set(selected));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
    setMessage(null);
    startTransition(async () => {
      const result = await setVideoPlaylists(videoId, [...next]);
      setMessage(result.ok ? { ok: true, text: "Playlists updated" } : { ok: false, text: result.error });
    });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="type-heading">Playlists</legend>
      {playlists.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No playlists yet.{" "}
          <Link href="/studio/playlists" className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
            Create one
          </Link>{" "}
          to group videos.
        </p>
      ) : (
        <ul className="space-y-1">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={chosen.has(playlist.id)}
                  onChange={() => toggle(playlist.id)}
                  disabled={pending}
                  className="size-4 accent-[var(--color-accent)]"
                />
                <span className="text-sm">{playlist.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-fg-muted" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </fieldset>
  );
}
