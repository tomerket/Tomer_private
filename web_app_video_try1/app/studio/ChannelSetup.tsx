"use client";

import { useActionState } from "react";
import { createChannel } from "./actions";
import { FormError, PrimaryButton, TextField } from "@/components/ui";

export function ChannelSetup() {
  const [state, action, pending] = useActionState(createChannel, null);
  return (
    <section className="max-w-md py-16">
      <h1 className="type-display">Name your channel</h1>
      <p className="mt-2 type-body text-fg-muted">
        Viewers see this name under every video you publish.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <TextField label="Channel name" name="name" required minLength={2} maxLength={60} />
        <FormError state={state} />
        <PrimaryButton pending={pending}>Create channel</PrimaryButton>
      </form>
    </section>
  );
}
