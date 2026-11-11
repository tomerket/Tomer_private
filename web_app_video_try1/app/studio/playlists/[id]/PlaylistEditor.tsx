"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormError, PrimaryButton, SavedNote, Switch, TextArea, TextField, buttonClass, inputClass } from "@/components/ui";
import {
  addPlaylistItem,
  deletePlaylist,
  removePlaylistItem,
  reorderPlaylist,
  setPlaylistPublished,
  updatePlaylist,
} from "../../actions";

type Entry = { id: string; title: string; isPublished: boolean; duration: string | null; thumb: string };

export function PlaylistEditor({
  playlist,
  entries,
  addable,
}: {
  playlist: { id: string; title: string; description: string; isPublished: boolean };
  entries: Entry[];
  addable: { id: string; title: string }[];
}) {
  const [detailsState, detailsAction, detailsPending] = useActionState(updatePlaylist.bind(null, playlist.id), null);
  const [order, setOrder] = useState(entries);
  const [published, setPublished] = useState(playlist.isPublished);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);

  // When the server sends a fresh list (after add/remove), adopt it.
  const [serverEntries, setServerEntries] = useState(entries);
  if (entries !== serverEntries) {
    setServerEntries(entries);
    setOrder(entries);
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setError(result.error ?? "That didn’t save. Try again.");
    });
  }

  function commitOrder(next: Entry[]) {
    setOrder(next);
    run(() => reorderPlaylist(playlist.id, next.map((e) => e.id)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    commitOrder(next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((e) => e.id !== dragId);
    const targetIndex = next.findIndex((e) => e.id === targetId);
    next.splice(targetIndex, 0, order.find((e) => e.id === dragId)!);
    setDragId(null);
    commitOrder(next);
  }

  return (
    <div className="mt-3 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Switch
            label={published ? "Unpublish playlist" : "Publish playlist"}
            checked={published}
            disabled={pending}
            onChange={(next) => {
              setPublished(next);
              run(() => setPlaylistPublished(playlist.id, next));
            }}
          />
          <span className="text-sm text-fg-muted">{published ? "Live on the site" : "Draft, only you can see it"}</span>
        </div>

        <form action={detailsAction} className="space-y-4">
          <TextField label="Name" name="title" defaultValue={playlist.title} required maxLength={100} />
          <TextArea label="Description" name="description" defaultValue={playlist.description} maxLength={2000} />
          <div className="flex items-center gap-4">
            <PrimaryButton pending={detailsPending}>{detailsPending ? "Saving…" : "Save playlist"}</PrimaryButton>
            <SavedNote state={detailsState} />
            <FormError state={detailsState} />
          </div>
        </form>

        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete “${playlist.title}”? The videos stay in your library.`)) run(() => deletePlaylist(playlist.id));
          }}
          className="text-sm text-danger underline-offset-4 hover:underline"
        >
          Delete playlist
        </button>
      </div>

      <div>
        <h2 className="type-heading">Videos in order</h2>

        {addable.length > 0 && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const videoId = String(new FormData(e.currentTarget).get("video") ?? "");
              if (videoId) run(() => addPlaylistItem(playlist.id, videoId));
            }}
          >
            <label htmlFor="add-video" className="sr-only">
              Video to add
            </label>
            <select id="add-video" name="video" className={inputClass} defaultValue="">
              <option value="" disabled>
                Choose a video to add
              </option>
              {addable.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className={`shrink-0 ${buttonClass("outline")}`}
            >
              Add
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

        {order.length === 0 ? (
          <p className="mt-6 text-sm text-fg-muted">This playlist is empty. Add a video above.</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {order.map((entry, index) => (
              <li
                key={entry.id}
                draggable
                onDragStart={() => setDragId(entry.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(entry.id)}
                className={`flex items-center gap-3 rounded-[var(--radius-control)] border bg-surface p-2 ${
                  dragId === entry.id ? "border-accent" : "border-line"
                }`}
              >
                <span aria-hidden className="w-6 cursor-grab text-center text-sm tabular-nums text-fg-faint">
                  {index + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail */}
                <img src={entry.thumb} alt="" width={96} height={54} className="aspect-video w-24 shrink-0 rounded-[var(--radius-chip)] bg-raised object-cover" />
                <div className="min-w-0 flex-1">
                  <Link href={`/studio/videos/${entry.id}`} className="line-clamp-1 text-sm font-medium hover:underline">
                    {entry.title}
                  </Link>
                  <p className="text-xs text-fg-muted">
                    {entry.duration ?? "Processing"}
                    {!entry.isPublished && " | Draft, hidden from viewers"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton label={`Move ${entry.title} up`} disabled={index === 0 || pending} onClick={() => move(index, -1)}>
                    <path d="M8 3.5 3.5 8h9L8 3.5Z" />
                  </IconButton>
                  <IconButton
                    label={`Move ${entry.title} down`}
                    disabled={index === order.length - 1 || pending}
                    onClick={() => move(index, 1)}
                  >
                    <path d="M8 12.5 12.5 8h-9L8 12.5Z" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${entry.title} from playlist`}
                    disabled={pending}
                    onClick={() => run(() => removePlaylistItem(playlist.id, entry.id))}
                  >
                    <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-8 place-items-center rounded-[var(--radius-chip)] text-fg-muted hover:bg-raised hover:text-fg disabled:opacity-30"
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
