import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioGate } from "../../StudioGate";
import { formatDuration } from "@/lib/imagekit";
import { deliverThumb } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";
import { PlaylistEditor } from "./PlaylistEditor";

export const metadata: Metadata = { title: "Edit playlist" };

export default function EditPlaylistPage({ params }: PageProps<"/studio/playlists/[id]">) {
  return <StudioGate>{({ channel }) => <EditPlaylist params={params} channelId={channel.id} />}</StudioGate>;
}

async function EditPlaylist({ params, channelId }: { params: Promise<{ id: string }>; channelId: string }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: playlist }, { data: items }, { data: videos }] = await Promise.all([
    supabase.from("playlists").select("*").eq("id", id).eq("channel_id", channelId).maybeSingle(),
    supabase
      .from("playlist_items")
      .select("position, videos(id, title, ik_file_path, thumbnail_offset, duration_seconds, is_published)")
      .eq("playlist_id", id)
      .order("position"),
    supabase.from("videos").select("id, title").eq("channel_id", channelId).order("created_at", { ascending: false }),
  ]);
  if (!playlist) notFound();

  const entries = (items ?? [])
    .filter((item) => item.videos)
    .map((item) => ({
      id: item.videos!.id,
      title: item.videos!.title,
      isPublished: item.videos!.is_published,
      duration: formatDuration(item.videos!.duration_seconds),
      thumb: deliverThumb(item.videos!.ik_file_path, item.videos!.thumbnail_offset, 320),
    }));
  const inPlaylist = new Set(entries.map((e) => e.id));

  return (
    <section className="pt-8">
      <Link href="/studio/playlists" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
        Back to playlists
      </Link>
      <PlaylistEditor
        playlist={{
          id: playlist.id,
          title: playlist.title,
          description: playlist.description,
          isPublished: playlist.is_published,
        }}
        entries={entries}
        addable={(videos ?? []).filter((v) => !inPlaylist.has(v.id))}
      />
    </section>
  );
}
