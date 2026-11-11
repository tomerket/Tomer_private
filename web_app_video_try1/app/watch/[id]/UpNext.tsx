import Link from "next/link";
import { Thumbnail } from "@/components/VideoCard";
import type { CardVideo } from "@/lib/catalog";

export function UpNext({
  currentId,
  videos,
  playlist,
}: {
  currentId: string;
  videos: CardVideo[];
  playlist: { id: string; title: string; position: number } | null;
}) {
  if (!videos.length) return <aside />;

  return (
    <aside aria-label={playlist ? `Playlist: ${playlist.title}` : "Up next"} className="min-w-0">
      {playlist ? (
        <div className="mb-3 rounded-[var(--radius-control)] border border-line px-4 py-3">
          <Link href={`/playlist/${playlist.id}`} className="type-title hover:underline">
            {playlist.title}
          </Link>
          <p className="type-meta text-fg-muted">
            {playlist.position} of {videos.length}
          </p>
        </div>
      ) : (
        <h2 className="mb-3 type-label text-fg-faint">Up next</h2>
      )}

      <ol className="space-y-2">
        {videos.map((video) => {
          const current = video.id === currentId;
          return (
            <li key={video.id}>
              <Link
                href={playlist ? `/watch/${video.id}?list=${playlist.id}` : `/watch/${video.id}`}
                aria-current={current ? "true" : undefined}
                className={`group flex gap-3 rounded-[var(--radius-control)] p-1.5 transition-colors ${
                  current ? "bg-surface ring-1 ring-accent/60" : "hover:bg-surface"
                }`}
              >
                <Thumbnail video={video} sizes="168px" className="w-40 shrink-0 !rounded-[var(--radius-control)]" />
                <div className="min-w-0 py-0.5">
                  <h3 className="line-clamp-2 type-title">{video.title}</h3>
                  <p className="mt-1 type-meta text-fg-muted">{video.channel.name}</p>
                  {current && <p className="type-label text-accent">Now playing</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
