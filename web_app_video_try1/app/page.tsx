import { Suspense } from "react";
import { VideoCard } from "@/components/VideoCard";
import { GridSkeleton } from "@/components/skeletons";
import { getFeed } from "@/lib/catalog";

export default function HomePage() {
  return (
    <div className="page pb-16 pt-6">
      <h1 className="sr-only">All videos</h1>
      <Suspense fallback={<GridSkeleton />}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Feed() {
  const videos = await getFeed();

  if (!videos.length) {
    return (
      <section className="flex flex-col items-center justify-center py-24 text-center">
        <div aria-hidden className="mb-8 aspect-video w-56 rounded-[var(--radius-thumb)] border border-line bg-gradient-to-b from-surface to-canvas" />
        <h2 className="type-display">Nothing is showing yet</h2>
        <p className="mt-3 max-w-md type-body text-fg-muted">
          Videos appear here once they are uploaded and published from the studio.
        </p>
      </section>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video, index) => (
        <VideoCard key={video.id} video={video} priority={index < 6} />
      ))}
    </div>
  );
}
