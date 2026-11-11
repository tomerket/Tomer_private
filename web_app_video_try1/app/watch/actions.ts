"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EngageResult = { ok: true } | { ok: false; error: string; needsSignIn?: boolean };

const SIGN_IN: EngageResult = { ok: false, error: "Sign in to do that.", needsSignIn: true };
const VIEWER_COOKIE = "sr_vk";

/**
 * Counts one view per viewer per video per day (deduplicated in the database).
 * Signed-out viewers are identified by an anonymous random cookie.
 */
export async function recordView(videoId: string): Promise<void> {
  const jar = await cookies();
  let key = jar.get(VIEWER_COOKIE)?.value;
  if (!key) {
    key = crypto.randomUUID();
    jar.set(VIEWER_COOKIE, key, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const supabase = await createClient();
  await supabase.rpc("record_view", { p_video_id: videoId, p_anon_key: key });
}

/**
 * Watch time heartbeat from the player: seconds actually played since the last
 * report and the furthest position reached. The database caps each report.
 */
export async function recordWatch(videoId: string, seconds: number, position: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const jar = await cookies();
  let key = jar.get(VIEWER_COOKIE)?.value;
  if (!key) {
    key = crypto.randomUUID();
    jar.set(VIEWER_COOKIE, key, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const supabase = await createClient();
  await supabase.rpc("record_watch", {
    p_video_id: videoId,
    p_anon_key: key,
    p_seconds: Math.round(seconds),
    p_position: Math.max(0, position),
  });
}

/** 1 = like, -1 = dislike, 0 = clear. */
export async function setReaction(videoId: string, value: 1 | -1 | 0): Promise<EngageResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN;
  const supabase = await createClient();
  const { error } =
    value === 0
      ? await supabase.from("video_reactions").delete().eq("video_id", videoId).eq("user_id", viewer.id)
      : await supabase
          .from("video_reactions")
          .upsert({ video_id: videoId, user_id: viewer.id, value }, { onConflict: "video_id,user_id" });
  if (error) return { ok: false, error: "That didn’t save. Try again." };
  refresh();
  return { ok: true };
}

export async function setSubscribed(channelId: string, subscribed: boolean): Promise<EngageResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN;
  const supabase = await createClient();
  const { error } = subscribed
    ? await supabase.from("subscriptions").upsert({ channel_id: channelId, user_id: viewer.id }, { onConflict: "channel_id,user_id" })
    : await supabase.from("subscriptions").delete().eq("channel_id", channelId).eq("user_id", viewer.id);
  if (error) return { ok: false, error: "That didn’t save. Try again." };
  refresh();
  return { ok: true };
}

export async function addComment(videoId: string, body: string): Promise<EngageResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN;
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > 2000) return { ok: false, error: "Comments can be up to 2,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ video_id: videoId, user_id: viewer.id, body: text });
  if (error) return { ok: false, error: "Your comment didn’t post. Try again." };
  refresh();
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<EngageResult> {
  const viewer = await getViewer();
  if (!viewer) return SIGN_IN;
  const supabase = await createClient();
  const { error, count } = await supabase.from("comments").delete({ count: "exact" }).eq("id", commentId);
  if (error || !count) return { ok: false, error: "That comment couldn’t be deleted." };
  refresh();
  return { ok: true };
}
