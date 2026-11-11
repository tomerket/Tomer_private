import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioGate } from "../../StudioGate";
import { SIGNED_DELIVERY } from "@/lib/env";
import { thumbUrl } from "@/lib/imagekit";
import { deliverThumb } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";
import { DetailsForm } from "./DetailsForm";
import { PlaylistPicker } from "./PlaylistPicker";
import { ThumbnailPicker } from "./ThumbnailPicker";

export const metadata: Metadata = { title: "Edit video" };

const FRAME_COUNT = 8;

export default function EditVideoPage({ params }: PageProps<"/studio/videos/[id]">) {
  return <StudioGate>{({ channel }) => <EditVideo params={params} channelId={channel.id} />}</StudioGate>;
}

async function EditVideo({ params, channelId }: { params: Promise<{ id: string }>; channelId: string }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: video }, { data: playlists }, { data: memberships }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", id).eq("channel_id", channelId).maybeSingle(),
    supabase.from("playlists").select("id, title").eq("channel_id", channelId).order("created_at"),
    supabase.from("playlist_items").select("playlist_id").eq("video_id", id),
  ]);
  if (!video) notFound();

  const duration = Math.max(1, Math.floor(video.duration_seconds ?? 0));
  const offsets = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.floor(((i + 0.5) / FRAME_COUNT) * duration),
  ).filter((value, index, all) => all.indexOf(value) === index);

  const candidates = offsets.map((offset) => ({ offset, src: deliverThumb(video.ik_file_path, offset, 320) }));
  const preview = deliverThumb(video.ik_file_path, video.thumbnail_offset, 960);

  return (
    <section className="pt-8">
      <Link href="/studio" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
        Back to videos
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="type-display">{video.title}</h1>
        {video.is_published && (
          <Link
            href={`/watch/${video.id}`}
            className="rounded-[var(--radius-chip)] border border-line px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
          >
            View on site
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-10">
          <DetailsForm videoId={video.id} title={video.title} description={video.description} />
          <PlaylistPicker
            videoId={video.id}
            playlists={playlists ?? []}
            selected={(memberships ?? []).map((m) => m.playlist_id)}
          />
        </div>
        <ThumbnailPicker
          videoId={video.id}
          duration={duration}
          current={video.thumbnail_offset}
          candidates={candidates}
          initialPreview={preview}
          previewBase={thumbUrl(video.ik_file_path, 0, 960).replace(/so-0,/, "so-{offset},")}
          signed={SIGNED_DELIVERY}
        />
      </div>
    </section>
  );
}
