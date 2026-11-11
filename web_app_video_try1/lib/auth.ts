import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Viewer = {
  id: string;
  email: string;
  isCreator: boolean;
  isMember: boolean;
  channel: Tables<"channels"> | null;
};

/** The signed-in user, verified with Supabase Auth. Deduplicated per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, member, channel] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("members").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("channels").select("*").eq("owner_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    isCreator: profile.data?.role === "creator",
    isMember: Boolean(member.data),
    channel: channel.data ?? null,
  };
});

export class NotAuthorizedError extends Error {}

/** For Server Actions and route handlers: the creator with a channel, or throw. */
export async function requireCreatorChannel() {
  const viewer = await getViewer();
  if (!viewer?.isCreator) throw new NotAuthorizedError("Studio access requires a creator account.");
  if (!viewer.channel) throw new NotAuthorizedError("Create your channel first.");
  return { viewer, channel: viewer.channel };
}
