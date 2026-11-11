import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/skeletons";
import { getPlaylists } from "@/lib/catalog";

export const metadata: Metadata = { title: "Playlists" };

export default function PlaylistsPage() {
  return (
    <div className="page pb-16 pt-6">
      <h1 className="type-display">Playlists</h1>
      <div className="mt-6">
        <Suspense fallback={<GridSkeleton count={8} />}>
          <PlaylistGrid />
        </Suspense>
      </div>
    </div>
  );
}

async function PlaylistGrid() {
  const playlists = await getPlaylists();
  if (!playlists.length) {
    return <p className="type-body text-fg-muted">No playlists have been published yet.</p>;
  }

  return (
    <div className="video-grid">
      {playlists.map((playlist) => (
        <article key={playlist.id} className="group">
          <Link href={`/playlist/${playlist.id}`} className="block">
            <div className="relative aspect-video overflow-hidden rounded-[var(--radius-thumb)] bg-raised">
              {/* Stacked edge signals "a set of videos" without extra chrome */}
              <span aria-hidden className="absolute inset-x-3 -top-1 h-2 rounded-t-[var(--radius-chip)] bg-line-strong" />
              {playlist.cover && (
                // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail srcset
                <img
                  src={playlist.cover.src}
                  srcSet={playlist.cover.srcSet}
                  sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 100vw"
                  alt=""
                  width={640}
                  height={360}
                  loading="lazy"
                  className="size-full object-cover transition-[filter] duration-200 group-hover:brightness-110"
                />
              )}
              <span className="absolute bottom-2 right-2 rounded-[var(--radius-chip)] bg-canvas/85 px-1.5 py-0.5 type-timecode text-fg">
                {playlist.count === 1 ? "1 video" : `${playlist.count} videos`}
              </span>
            </div>
            <h2 className="mt-3 line-clamp-2 type-title">{playlist.title}</h2>
            {playlist.description && <p className="mt-1 line-clamp-1 type-meta text-fg-muted">{playlist.description}</p>}
          </Link>
        </article>
      ))}
    </div>
  );
}
