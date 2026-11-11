import "server-only";
import { connection } from "next/server";
import type { Viewer } from "@/lib/auth";
import { createClient, createPublicClient } from "@/lib/supabase/server";

/**
 * Live engagement reads for the watch page. Not cached: counts and comments
 * change with every interaction. Callers render these inside Suspense.
 */

export type VideoEngagement = {
  views: number;
  likes: number;
  dislikes: number;
  commentCount: number;
  subscribers: number;
  myReaction: 1 | -1 | 0;
  subscribed: boolean;
};

export async function getEngagement(videoId: string, channelId: string, viewer: Viewer | null): Promise<VideoEngagement> {
  await connection();
  const pub = createPublicClient();
  const [{ data: stats }, { data: channel }, mine] = await Promise.all([
    pub.from("video_stats").select("views, likes, dislikes, comments").eq("video_id", videoId).maybeSingle(),
    pub.from("channel_stats").select("subscribers").eq("channel_id", channelId).maybeSingle(),
    viewer ? viewerState(videoId, channelId, viewer.id) : Promise.resolve({ reaction: 0 as const, subscribed: false }),
  ]);
  return {
    views: stats?.views ?? 0,
    likes: stats?.likes ?? 0,
    dislikes: stats?.dislikes ?? 0,
    commentCount: stats?.comments ?? 0,
    subscribers: channel?.subscribers ?? 0,
    myReaction: mine.reaction,
    subscribed: mine.subscribed,
  };
}

async function viewerState(videoId: string, channelId: string, userId: string) {
  const supabase = await createClient();
  const [{ data: reaction }, { data: sub }] = await Promise.all([
    supabase.from("video_reactions").select("value").eq("video_id", videoId).eq("user_id", userId).maybeSingle(),
    supabase.from("subscriptions").select("user_id").eq("channel_id", channelId).eq("user_id", userId).maybeSingle(),
  ]);
  const value = reaction?.value;
  return { reaction: (value === 1 || value === -1 ? value : 0) as 1 | -1 | 0, subscribed: Boolean(sub) };
}

export type CommentItem = { id: string; userId: string; author: string; body: string; ago: string };

export async function getComments(videoId: string): Promise<CommentItem[]> {
  await connection();
  const { data } = await createPublicClient()
    .from("comments")
    .select("id, user_id, author_name, body, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    author: c.author_name || "Viewer",
    body: c.body,
    ago: timeAgo(c.created_at),
  }));
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** Request-time relative time ("19 minutes ago"). Call after connection(). */
export function timeAgo(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
