import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { timeAgo } from "@/lib/engagement";
import { deliverThumb } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";
import { StudioGate, type CreatorContext } from "../StudioGate";
import { compact, formatWatch, StatCard } from "./parts";
import { ViewsChart } from "./ViewsChart";

export const metadata: Metadata = { title: "Analytics" };

const DAYS = 28;

export default function AnalyticsPage() {
  return <StudioGate>{({ channel }) => <Analytics channel={channel} />}</StudioGate>;
}

async function Analytics({ channel }: { channel: CreatorContext["channel"] }) {
  await connection();
  const supabase = await createClient();
  const [daily, videos, channelStats, subs] = await Promise.all([
    supabase.rpc("creator_daily_views_v2", { p_days: DAYS }),
    supabase.rpc("creator_video_analytics_v2", { p_days: DAYS }),
    supabase.from("channel_stats").select("subscribers").eq("channel_id", channel.id).maybeSingle(),
    supabase.rpc("creator_daily_subscribers", { p_days: DAYS }),
  ]);

  const days = daily.data ?? [];
  const rows = videos.data ?? [];
  const views28 = days.reduce((s, d) => s + Number(d.views), 0);
  const watch28 = days.reduce((s, d) => s + Number(d.watch_seconds), 0);
  const gained = (subs.data ?? []).reduce((s, d) => s + Number(d.gained), 0);
  const likes = rows.reduce((s, r) => s + r.likes, 0);
  const comments = rows.reduce((s, r) => s + r.comments, 0);

  return (
    <section className="pt-8">
      <h1 className="type-display">{channel.name}</h1>
      <p className="type-meta mt-1.5 text-fg-muted">Analytics for videos you own. Only you can see this page.</p>

      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Views" value={compact.format(views28)} note={`last ${DAYS} days`} />
        <StatCard label="Watch time" value={formatWatch(watch28)} note={`last ${DAYS} days`} />
        <StatCard label="Subscribers" value={compact.format(channelStats.data?.subscribers ?? 0)} note={gained ? `+${gained} in ${DAYS} days` : "no change"} />
        <StatCard label="Likes" value={compact.format(likes)} note="all time" />
        <StatCard label="Comments" value={compact.format(comments)} note="all time" />
      </div>

      <div className="mt-4">
        <ViewsChart title={`Views · last ${DAYS} days`} points={days.map((d) => ({ day: d.day, value: Number(d.views) }))} />
      </div>

      <h2 className="type-heading mt-10">Your videos</h2>
      {rows.length === 0 ? (
        <p className="type-body mt-3 text-fg-muted">
          No videos yet.{" "}
          <Link href="/studio/upload" className="text-fg underline decoration-line underline-offset-4">
            Upload one
          </Link>{" "}
          to start collecting views.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-thumb)] border border-line">
          <table className="w-full min-w-[680px] text-left">
            <thead className="type-label text-fg-faint">
              <tr className="border-b border-line bg-surface/50">
                <th scope="col" className="px-4 py-3 font-semibold">Video</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Avg watched</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Likes</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Comments</th>
              </tr>
            </thead>
            <tbody className="type-meta tabular-nums">
              {rows.map((r) => (
                <tr key={r.video_id} className="group relative border-b border-line/70 last:border-0 hover:bg-surface/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit frame */}
                      <img
                        src={deliverThumb(r.ik_file_path, r.thumbnail_offset, 320)}
                        alt=""
                        width={112}
                        height={63}
                        loading="lazy"
                        className="aspect-video w-28 shrink-0 rounded-[var(--radius-chip)] bg-raised object-cover"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/studio/analytics/${r.video_id}`}
                          className="type-title line-clamp-1 after:absolute after:inset-0 after:content-['']"
                        >
                          {r.title}
                        </Link>
                        <p className="text-fg-faint">
                          {r.is_published ? (r.published_at ? timeAgo(r.published_at) : "Published") : "Draft"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-fg">{compact.format(r.views_total)}</td>
                  <td className="px-4 py-3 text-right text-fg-muted">{r.avg_watched_pct != null ? `${r.avg_watched_pct}%` : "—"}</td>
                  <td className="px-4 py-3 text-right text-fg-muted">{compact.format(r.likes)}</td>
                  <td className="px-4 py-3 text-right text-fg-muted">{compact.format(r.comments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="type-meta mt-8 text-fg-faint">
        Views count once per viewer per video per day. Watch time is the seconds actually played, reported by the player.
      </p>
    </section>
  );
}
