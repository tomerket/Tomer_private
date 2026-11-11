import "server-only";
import { connection } from "next/server";
import { toCard, VIDEO_FIELDS, type VideoRow, type WatchVideo } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in viewer's own library: subscriptions feed and watch history.
 * Request-time reads (session-dependent); render inside Suspense.
 */

export async function getSubscriptionFeed(userId: string): Promise<{ channels: number; videos: WatchVideo[] }> {
  await connection();
  const supabase = await createClient();
  const { data: subs } = await supabase.from("subscriptions").select("channel_id").eq("user_id", userId);
  const channelIds = (subs ?? []).map((s) => s.channel_id);
  if (!channelIds.length) return { channels: 0, videos: [] };

  const { data } = await supabase
    .from("videos")
    .select(VIDEO_FIELDS)
    .eq("is_published", true)
    .in("channel_id", channelIds)
    .order("published_at", { ascending: false })
    .limit(120);
  return { channels: channelIds.length, videos: ((data ?? []) as unknown as VideoRow[]).map(toCard) };
}

export type HistoryDay = { label: string; videos: WatchVideo[] };

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

export async function getWatchHistory(userId: string): Promise<HistoryDay[]> {
  await connection();
  const supabase = await createClient();
  const { data: views } = await supabase
    .from("video_views")
    .select("video_id, day")
    .eq("viewer_key", userId)
    .order("day", { ascending: false })
    .limit(300);
  if (!views?.length) return [];

  const ids = [...new Set(views.map((v) => v.video_id))];
  const { data } = await supabase.from("videos").select(VIDEO_FIELDS).in("id", ids).eq("is_published", true);
  const byId = new Map(((data ?? []) as unknown as VideoRow[]).map((row) => [row.id, toCard(row)]));

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const groups = new Map<string, WatchVideo[]>();
  const seen = new Set<string>();
  for (const view of views) {
    const video = byId.get(view.video_id);
    // Each video appears once, on the most recent day it was watched.
    if (!video || seen.has(video.id)) continue;
    seen.add(video.id);
    const list = groups.get(view.day) ?? [];
    list.push(video);
    groups.set(view.day, list);
  }
  return [...groups.entries()].map(([day, videos]) => ({
    label: day === today ? "Today" : day === yesterday ? "Yesterday" : dayLabel.format(new Date(`${day}T00:00:00Z`)),
    videos,
  }));
}
