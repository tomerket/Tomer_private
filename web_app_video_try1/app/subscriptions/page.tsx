import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GridSkeleton } from "@/components/skeletons";
import { buttonClass } from "@/components/ui";
import { VideoCard } from "@/components/VideoCard";
import { getViewer } from "@/lib/auth";
import { getSubscriptionFeed } from "@/lib/library";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  return (
    <div className="page pb-16 pt-6">
      <h1 className="type-display">Subscriptions</h1>
      <div className="mt-6">
        <Suspense fallback={<GridSkeleton count={12} />}>
          <Feed />
        </Suspense>
      </div>
    </div>
  );
}

async function Feed() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <EmptyState
        title="Sign in to see your subscriptions"
        body="New videos from the channels you subscribe to show up here."
        action={<Link href="/login?next=/subscriptions" className={buttonClass("primary")}>Sign in</Link>}
      />
    );
  }

  const { channels, videos } = await getSubscriptionFeed(viewer.id);
  if (!channels) {
    return (
      <EmptyState
        title="No subscriptions yet"
        body="Open a video and press Subscribe under it. That channel’s new videos will appear here."
        action={<Link href="/" className={buttonClass("outline")}>Browse videos</Link>}
      />
    );
  }
  if (!videos.length) {
    return <EmptyState title="Nothing new" body="The channels you follow haven’t published anything yet." />;
  }

  return (
    <div className="video-grid">
      {videos.map((video, i) => (
        <VideoCard key={video.id} video={video} priority={i < 6} />
      ))}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="max-w-md py-16">
      <h2 className="type-heading">{title}</h2>
      <p className="type-body mt-2 text-fg-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
