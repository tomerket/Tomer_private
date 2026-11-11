import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { buttonClass } from "@/components/ui";
import { timeAgo } from "@/lib/engagement";
import { formatDuration } from "@/lib/imagekit";
import { deliverThumb } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";
import { StudioGate } from "../../StudioGate";
import { compact, formatWatch, StatCard } from "../parts";
import { ViewsChart } from "../ViewsChart";

export const metadata: Metadata = { title: "Video analytics" };

const DAYS = 28;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function VideoAnalyticsPage({ params }: PageProps<"/studio/analytics/[id]">) {
  return <StudioGate>{() => <VideoAnalytics params={params} />}</StudioGate>;
}

async function VideoAnalytics({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await connection();
  const supabase = await createClient();
  const [videos, daily] = await Promise.all([
    supabase.rpc("creator_video_analytics_v2", { p_days: DAYS }),
    supabase.rpc("creator_daily_views_v2", { p_days: DAYS, p_video_id: id }),
  ]);
  // The functions only return the caller's own videos, so this also checks ownership.
  const video = (videos.data ?? []).find((v) => v.video_id === id);
  if (!video) notFound();

  const days = daily.data ?? [];
  const views28 = days.reduce((s, d) => s + Number(d.views), 0);
  const watch28 = days.reduce((s, d) => s + Number(d.watch_seconds), 0);
  const votes = video.likes + video.dislikes;
  const avgView = views28 ? watch28 / views28 : 0;

  return (
    <section className="pt-8">
      <Link href="/studio/analytics" className="type-meta text-fg-muted underline-offset-4 hover:text-fg hover:underline">
        Back to channel analytics
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit frame */}
        <img
          src={deliverThumb(video.ik_file_path, video.thumbnail_offset, 480)}
          alt=""
          width={192}
          height={108}
          className="aspect-video w-48 rounded-[var(--radius-control)] bg-raised object-cover ring-1 ring-inset ring-white/[0.07]"
        />
        <div className="min-w-0 flex-1">
          <h1 className="type-display">{video.title}</h1>
          <p className="type-meta mt-1.5 text-fg-muted">
            {video.is_published ? `Published ${video.published_at ? timeAgo(video.published_at) : ""}` : "Draft, not visible to viewers"}
            {video.duration_seconds ? ` · ${formatDuration(Number(video.duration_seconds))} long` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {video.is_published && (
            <Link href={`/watch/${video.video_id}`} className={buttonClass("ghost")}>
              View on site
            </Link>
          )}
          <Link href={`/studio/videos/${video.video_id}`} className={buttonClass("outline")}>
            Edit video
          </Link>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Views" value={compact.format(views28)} note={`${compact.format(video.views_total)} all time`} />
        <StatCard label="Watch time" value={formatWatch(watch28)} note={`last ${DAYS} days`} />
        <StatCard
          label="Avg watched"
          value={video.avg_watched_pct != null ? `${video.avg_watched_pct}%` : "—"}
          note={avgView ? `${formatWatch(avgView)} per view` : "no plays yet"}
        />
        <StatCard
          label="Likes"
          value={compact.format(video.likes)}
          note={votes ? `${Math.round((video.likes / votes) * 100)}% liked · ${video.dislikes} dislikes` : "no votes yet"}
        />
        <StatCard label="Comments" value={compact.format(video.comments)} note="all time" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ViewsChart title={`Views · last ${DAYS} days`} points={days.map((d) => ({ day: d.day, value: Number(d.views) }))} />
        <ViewsChart
          title={`Watch time · last ${DAYS} days`}
          unit="watch"
          points={days.map((d) => ({ day: d.day, value: Number(d.watch_seconds) }))}
        />
      </div>
    </section>
  );
}
