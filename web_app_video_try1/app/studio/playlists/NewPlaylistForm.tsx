"use client";

import { useActionState } from "react";
import { FormError, PrimaryButton, inputClass } from "@/components/ui";
import { createPlaylist } from "../actions";

export function NewPlaylistForm() {
  const [state, action, pending] = useActionState(createPlaylist, null);
  return (
    <form action={action} className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor="new-playlist" className="sr-only">
          Playlist name
        </label>
        <input id="new-playlist" name="title" required maxLength={100} placeholder="Playlist name" className={inputClass} />
        <div className="mt-1">
          <FormError state={state} />
        </div>
      </div>
      <PrimaryButton pending={pending}>Create playlist</PrimaryButton>
    </form>
  );
}
