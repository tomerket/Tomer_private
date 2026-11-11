"use client";

import { useActionState } from "react";
import { FormError, PrimaryButton, SavedNote, TextArea, TextField } from "@/components/ui";
import { updateVideoDetails } from "../../actions";

export function DetailsForm({ videoId, title, description }: { videoId: string; title: string; description: string }) {
  const [state, action, pending] = useActionState(updateVideoDetails.bind(null, videoId), null);
  return (
    <form action={action} className="space-y-4">
      <h2 className="type-heading">Details</h2>
      <TextField label="Title" name="title" defaultValue={title} required maxLength={120} />
      <TextArea label="Description" name="description" defaultValue={description} maxLength={5000} />
      <div className="flex items-center gap-4">
        <PrimaryButton pending={pending}>{pending ? "Saving…" : "Save details"}</PrimaryButton>
        <SavedNote state={state} />
        <FormError state={state} />
      </div>
    </form>
  );
}
