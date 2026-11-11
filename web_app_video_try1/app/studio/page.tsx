import type { Metadata } from "next";
import Link from "next/link";
import { StudioGate, type CreatorContext } from "./StudioGate";
import { formatDuration } from "@/lib/imagekit";
import { thumbSet } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";
import { VideoRow } from "./VideoRow";

export const metadata: Metadata = { title: "Videos" };

export default function StudioVideosPage() {
  return <StudioGate>{({ channel }) => <VideoList channel={channel} />}</StudioGate>;
}

async function VideoList({ channel }: { channel: CreatorContext["channel"] }) {
  const supabase = await createClient();
  const { data: videos } = await supabase
    .from("videos")
    .select("id, title, ik_file_path, thumbnail_offset, duration_seconds, is_published, is_members_only, updated_at")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false });

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-display">Videos</h1>
          <p className="mt-1 type-body text-fg-muted">{channel.name}</p>
        </div>
        <Link
          href="/studio/upload"
          className="rounded-[var(--radius-pill)] bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-[filter] hover:brightness-110"
        >
          Upload videos
        </Link>
      </div>

      {!videos?.length ? (
        <div className="mt-10 rounded-[var(--radius-thumb)] border border-dashed border-line px-6 py-16 text-center">
          <p className="type-heading">No videos yet</p>
          <p className="mt-1 text-sm text-fg-muted">Upload your first video to start building the library.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="type-label text-fg-faint">
              <tr className="border-b border-line">
                <th scope="col" className="py-3 pr-4 font-medium">Video</th>
                <th scope="col" className="w-24 py-3 pr-4 font-medium">Length</th>
                <th scope="col" className="w-28 py-3 pr-4 font-medium">Published</th>
                <th scope="col" className="w-32 py-3 pr-4 font-medium">Members only</th>
                <th scope="col" className="w-20 py-3 font-medium"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <VideoRow
                  key={video.id}
                  video={{
                    id: video.id,
                    title: video.title,
                    duration: formatDuration(video.duration_seconds),
                    isPublished: video.is_published,
                    isMembersOnly: video.is_members_only,
                    thumb: thumbSet(video.ik_file_path, video.thumbnail_offset).src,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
