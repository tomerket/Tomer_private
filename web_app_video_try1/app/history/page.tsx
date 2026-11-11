import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/skeletons";
import { buttonClass } from "@/components/ui";
import { VideoCard } from "@/components/VideoCard";
import { getViewer } from "@/lib/auth";
import { getWatchHistory } from "@/lib/library";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="page pb-16 pt-6">
      <h1 className="type-display">History</h1>
      <div className="mt-6">
        <Suspense fallback={<GridSkeleton count={8} />}>
          <History />
        </Suspense>
      </div>
    </div>
  );
}

async function History() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div className="max-w-md py-16">
        <h2 className="type-heading">Sign in to see your history</h2>
        <p className="type-body mt-2 text-fg-muted">Videos you watch while signed in are listed here, newest first.</p>
        <div className="mt-6">
          <Link href="/login?next=/history" className={buttonClass("primary")}>Sign in</Link>
        </div>
      </div>
    );
  }

  const days = await getWatchHistory(viewer.id);
  if (!days.length) {
    return (
      <div className="max-w-md py-16">
        <h2 className="type-heading">Nothing watched yet</h2>
        <p className="type-body mt-2 text-fg-muted">Videos you open appear here, grouped by the day you watched them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {days.map((day) => (
        <section key={day.label}>
          <h2 className="type-label mb-4 text-fg-faint">{day.label}</h2>
          <div className="video-grid">
            {day.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
