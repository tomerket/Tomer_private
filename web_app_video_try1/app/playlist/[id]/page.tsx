import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChannelAvatar, Thumbnail } from "@/components/VideoCard";
import { getPlaylist } from "@/lib/catalog";

export async function generateMetadata({ params }: PageProps<"/playlist/[id]">): Promise<Metadata> {
  const playlist = await getPlaylist((await params).id);
  return playlist ? { title: playlist.title, description: playlist.description || undefined } : {};
}

export default function PlaylistPage({ params }: PageProps<"/playlist/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 sm:px-6">
      <Suspense fallback={<div className="h-64 rounded-[var(--radius-thumb)] bg-surface" aria-hidden />}>
        <PlaylistView params={params} />
      </Suspense>
    </div>
  );
}

async function PlaylistView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlist = await getPlaylist(id);
  if (!playlist) notFound();

  const first = playlist.videos[0];

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-display">{playlist.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {playlist.count === 1 ? "1 video" : `${playlist.count} videos`}
          </p>
          {playlist.description && <p className="mt-3 max-w-2xl type-body text-fg-muted">{playlist.description}</p>}
        </div>
        {first && (
          <Link
            href={`/watch/${first.id}?list=${playlist.id}`}
            className="self-start rounded-[var(--radius-pill)] bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-[filter] hover:brightness-110 sm:self-auto"
          >
            Play all
          </Link>
        )}
      </header>

      {playlist.videos.length === 0 ? (
        <p className="mt-10 type-body text-fg-muted">This playlist has no published videos yet.</p>
      ) : (
        <ol className="mt-8 space-y-1">
          {playlist.videos.map((video, index) => (
            <li key={video.id}>
              <Link
                href={`/watch/${video.id}?list=${playlist.id}`}
                className="group flex items-center gap-4 rounded-[var(--radius-control)] p-2 hover:bg-surface"
              >
                <span className="w-6 text-center text-sm tabular-nums text-fg-faint">{index + 1}</span>
                <Thumbnail video={video} sizes="200px" className="w-40 shrink-0 sm:w-48" />
                <div className="min-w-0">
                  <h2 className="line-clamp-2 type-title text-[15px]">{video.title}</h2>
                  <p className="mt-1 flex items-center gap-2 type-meta text-fg-muted">
                    <ChannelAvatar name={video.channel.name} size="size-5" />
                    {video.channel.name}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
