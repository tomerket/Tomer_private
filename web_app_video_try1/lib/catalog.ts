import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { formatDuration } from "@/lib/imagekit";
import { deliverThumb, thumbSet, type ThumbSet } from "@/lib/imagekit.server";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Public catalog reads. Everything here runs as the anonymous role, so RLS only
 * returns published rows. Results are cached and invalidated by the studio's
 * updateTag("videos") / updateTag("playlists") calls.
 *
 * Expiry stays under the 6-hour minimum lifetime of signed thumbnail URLs.
 */
const catalogLife = { stale: 300, revalidate: 3600, expire: 3 * 3600 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * "3 days ago". Only called inside "use cache" functions, where reading the
 * clock is allowed; the cached value is at most one revalidation (1h) old.
 */
function timeAgo(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export type CardVideo = {
  id: string;
  title: string;
  duration: string | null;
  isMembersOnly: boolean;
  published: string | null;
  /** Total views, "1.2K"-style formatting happens in the UI. */
  views: number;
  channel: { name: string; handle: string };
  thumb: ThumbSet;
};

export type WatchVideo = CardVideo & {
  description: string;
  filePath: string;
  thumbnailOffset: number;
  /** 1280px frame for Open Graph previews (signed when delivery is restricted). */
  shareImage: string;
  /** ISO timestamp; the watch page renders "x minutes ago" from it at request time. */
  publishedAt: string | null;
  channelId: string;
};

export type VideoRow = {
  id: string;
  title: string;
  description: string;
  ik_file_path: string;
  thumbnail_offset: number;
  duration_seconds: number | null;
  is_members_only: boolean;
  published_at: string | null;
  channel_id: string;
  channels: { name: string; handle: string } | null;
  video_stats: { views: number } | null;
};

export const VIDEO_FIELDS =
  "id, title, description, ik_file_path, thumbnail_offset, duration_seconds, is_members_only, published_at, channels(name, handle), channel_id, video_stats(views)";

export function toCard(row: VideoRow): WatchVideo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    filePath: row.ik_file_path,
    thumbnailOffset: row.thumbnail_offset,
    duration: formatDuration(row.duration_seconds),
    isMembersOnly: row.is_members_only,
    published: row.published_at ? timeAgo(row.published_at) : null,
    publishedAt: row.published_at,
    views: row.video_stats?.views ?? 0,
    channelId: row.channel_id,
    channel: row.channels ?? { name: "Unknown channel", handle: "" },
    thumb: thumbSet(row.ik_file_path, row.thumbnail_offset),
    shareImage: deliverThumb(row.ik_file_path, row.thumbnail_offset, 1280),
  };
}

export async function getFeed(): Promise<WatchVideo[]> {
  "use cache";
  cacheTag("videos");
  cacheLife(catalogLife);

  const { data, error } = await createPublicClient()
    .from("videos")
    .select(VIDEO_FIELDS)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return (data as VideoRow[]).map(toCard);
}

export async function getVideo(id: string): Promise<WatchVideo | null> {
  "use cache";
  cacheTag("videos", `video:${id}`);
  cacheLife(catalogLife);

  if (!UUID.test(id)) return null;
  const { data } = await createPublicClient()
    .from("videos")
    .select(VIDEO_FIELDS)
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  return data ? toCard(data as VideoRow) : null;
}

export type PlaylistSummary = {
  id: string;
  title: string;
  description: string;
  count: number;
  cover: ThumbSet | null;
};

export type PlaylistDetail = PlaylistSummary & { videos: WatchVideo[] };

type PlaylistRow = {
  id: string;
  title: string;
  description: string;
  playlist_items: { position: number; videos: VideoRow | null }[];
};

function toPlaylist(row: PlaylistRow): PlaylistDetail {
  const videos = [...row.playlist_items]
    .sort((a, b) => a.position - b.position)
    .map((item) => item.videos)
    .filter((video): video is VideoRow => Boolean(video))
    .map(toCard);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    count: videos.length,
    cover: videos[0]?.thumb ?? null,
    videos,
  };
}

const PLAYLIST_FIELDS = `id, title, description, playlist_items(position, videos(${VIDEO_FIELDS}))`;

export async function getPlaylists(): Promise<PlaylistSummary[]> {
  "use cache";
  cacheTag("playlists", "videos");
  cacheLife(catalogLife);

  const { data, error } = await createPublicClient()
    .from("playlists")
    .select(PLAYLIST_FIELDS)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as PlaylistRow[])
    .map(toPlaylist)
    .filter((playlist) => playlist.count > 0)
    .map((p) => ({ id: p.id, title: p.title, description: p.description, count: p.count, cover: p.cover }));
}

export async function getPlaylist(id: string): Promise<PlaylistDetail | null> {
  "use cache";
  cacheTag("playlists", "videos", `playlist:${id}`);
  cacheLife(catalogLife);

  if (!UUID.test(id)) return null;
  const { data } = await createPublicClient()
    .from("playlists")
    .select(PLAYLIST_FIELDS)
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  return data ? toPlaylist(data as unknown as PlaylistRow) : null;
}
