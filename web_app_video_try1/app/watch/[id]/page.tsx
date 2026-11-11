import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Player } from "@/components/player/Player";
import { WatchSkeleton } from "@/components/skeletons";
import { ChannelAvatar, LockIcon } from "@/components/VideoCard";
import { getViewer } from "@/lib/auth";
import { getFeed, getPlaylist, getVideo, type WatchVideo } from "@/lib/catalog";
import { getComments, getEngagement, timeAgo } from "@/lib/engagement";
import { mediaUrl, thumbUrl } from "@/lib/imagekit";
import { Description } from "./Description";
import { CommentForm, DeleteCommentButton, ReactionPill, SubscribeButton, ViewTracker } from "./Engagement";
import { UpNext } from "./UpNext";

export async function generateMetadata({ params }: PageProps<"/watch/[id]">): Promise<Metadata> {
  const video = await getVideo((await params).id);
  if (!video) return {};
  const image = video.shareImage;
  return {
    title: video.title,
    description: video.description.slice(0, 200) || undefined,
    openGraph: { title: video.title, type: "video.other", images: [{ url: image, width: 1280, height: 720 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function WatchPage({ params, searchParams }: PageProps<"/watch/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 pb-16 pt-6 sm:px-6">
      <Suspense fallback={<WatchSkeleton />}>
        <Watch params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Watch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const listId = typeof query.list === "string" ? query.list : undefined;

  const [video, playlist] = await Promise.all([getVideo(id), listId ? getPlaylist(listId) : null]);
  if (!video) notFound();

  const inPlaylist = playlist?.videos.some((v) => v.id === video.id) ? playlist : null;
  const queue = inPlaylist ? inPlaylist.videos : (await getFeed()).filter((v) => v.id !== video.id).slice(0, 20);
  const index = inPlaylist ? queue.findIndex((v) => v.id === video.id) : -1;
  const next = inPlaylist ? queue[index + 1] : undefined;

  return (
    <div className="watch-layout">
      <div className="min-w-0">
        <PlayerSlot video={video} nextHref={next ? `/watch/${next.id}?list=${inPlaylist!.id}` : undefined} />

        <h1 className="mt-5 type-heading text-[22px] leading-7 sm:text-[24px] sm:leading-8">
          {video.title}
        </h1>
        <Suspense fallback={<DetailsSkeleton video={video} />}>
          <VideoDetails video={video} returnTo={`/watch/${video.id}${inPlaylist ? `?list=${inPlaylist.id}` : ""}`} />
        </Suspense>
      </div>

      <UpNext
        currentId={video.id}
        videos={queue}
        playlist={inPlaylist ? { id: inPlaylist.id, title: inPlaylist.title, position: index + 1 } : null}
      />
    </div>
  );
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function plural(n: number, one: string, many: string) {
  return `${compact.format(n)} ${n === 1 ? one : many}`;
}

/** Channel row, reactions, views panel and comments: live data, streamed in. */
async function VideoDetails({ video, returnTo }: { video: WatchVideo; returnTo: string }) {
  const viewer = await getViewer();
  const [engagement, comments] = await Promise.all([
    getEngagement(video.id, video.channelId, viewer),
    getComments(video.id),
  ]);
  const ownsChannel = Boolean(viewer?.isCreator && viewer.channel?.id === video.channelId);
  const published = video.publishedAt ? timeAgo(video.publishedAt) : null;

  return (
    <>
      <ViewTracker videoId={video.id} />

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <ChannelAvatar name={video.channel.name} size="size-12 text-[16px]" />
          <div className="min-w-0">
            <p className="type-title truncate text-[15px]">{video.channel.name}</p>
            <p className="type-meta text-fg-muted">{plural(engagement.subscribers, "subscriber", "subscribers")}</p>
          </div>
          {!ownsChannel && (
            <div className="ml-2">
              <SubscribeButton channelId={video.channelId} subscribed={engagement.subscribed} returnTo={returnTo} />
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {video.isMembersOnly && (
            <span className="type-label inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-surface px-2 py-1.5 text-fg">
              <LockIcon />
              Members
            </span>
          )}
          <ReactionPill
            videoId={video.id}
            mine={engagement.myReaction}
            likes={engagement.likes}
            dislikes={engagement.dislikes}
            returnTo={returnTo}
          />
        </div>
      </div>

      <Description
        header={[plural(engagement.views, "view", "views"), published].filter(Boolean).join(" · ")}
        text={video.description}
      />

      <section aria-label="Comments" className="mt-10">
        <h2 className="type-heading">{plural(engagement.commentCount, "Comment", "Comments")}</h2>
        <div className="mt-5">
          <CommentForm videoId={video.id} signedIn={Boolean(viewer)} returnTo={returnTo} />
        </div>
        {comments.length > 0 && (
          <ul className="mt-8 space-y-6">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <ChannelAvatar name={comment.author} size="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="type-title">{comment.author}</span>
                    <span className="type-meta text-fg-faint">{comment.ago}</span>
                  </p>
                  <p className="type-body mt-1 whitespace-pre-line break-words text-fg/90">{comment.body}</p>
                  {(viewer?.id === comment.userId || ownsChannel) && (
                    <div className="mt-1.5">
                      <DeleteCommentButton commentId={comment.id} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function DetailsSkeleton({ video }: { video: WatchVideo }) {
  return (
    <div aria-hidden>
      <div className="mt-4 flex items-center gap-3">
        <ChannelAvatar name={video.channel.name} size="size-12 text-[16px]" />
        <div className="space-y-2">
          <p className="type-title text-[15px]">{video.channel.name}</p>
          <div className="h-3 w-24 rounded bg-surface" />
        </div>
        <div className="ml-auto h-10 w-36 rounded-[var(--radius-pill)] bg-surface" />
      </div>
      <div className="mt-5 h-24 rounded-[var(--radius-thumb)] bg-surface" />
    </div>
  );
}

async function PlayerSlot({ video, nextHref }: { video: WatchVideo; nextHref?: string }) {
  const viewer = await getViewer();
  const ownsVideo = viewer?.isCreator && viewer.channel?.handle === video.channel.handle;
  const allowed = !video.isMembersOnly || viewer?.isMember || ownsVideo;

  if (!allowed) return <MembersGate video={video} signedIn={Boolean(viewer)} />;

  return (
    <Player
      videoId={video.id}
      src={mediaUrl(video.filePath)}
      title={video.title}
      description={video.description}
      poster={thumbUrl(video.filePath, video.thumbnailOffset, 1280)}
      nextHref={nextHref}
      viewerId={viewer?.id}
    />
  );
}

function MembersGate({ video, signedIn }: { video: WatchVideo; signedIn: boolean }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-[var(--radius-thumb)] bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- blurred backdrop from the chosen frame */}
      <img src={video.thumb.src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-xl" />
      <div className="relative flex size-full flex-col items-center justify-center px-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <LockIcon className="size-5" />
        </span>
        <h2 className="mt-4 type-heading">This video is for members</h2>
        <p className="mt-2 max-w-sm type-body text-fg-muted">
          {signedIn
            ? "Your account doesn’t have a membership yet. Contact the channel owner to get access."
            : "Sign in with a member account to watch."}
        </p>
        {!signedIn && (
          <Link
            href={`/login?next=${encodeURIComponent(`/watch/${video.id}`)}`}
            className="mt-5 rounded-[var(--radius-pill)] bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-[filter] hover:brightness-110"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
