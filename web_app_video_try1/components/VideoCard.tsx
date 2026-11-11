import Link from "next/link";
import type { CardVideo } from "@/lib/catalog";

/** Matches the .video-grid column steps in globals.css. */
export const GRID_SIZES =
  "(min-width: 1800px) 16vw, (min-width: 1440px) 19vw, (min-width: 1120px) 24vw, (min-width: 840px) 32vw, (min-width: 520px) 48vw, 100vw";

/**
 * Thumbnail card (see design-system/screening-room/MASTER.md).
 * Image 16:9 with a hairline border, mono timecode badge, amber playhead that
 * nudges in on hover, 36px avatar, two-line title, channel, meta line.
 */
export function VideoCard({
  video,
  href,
  priority,
  forceHover,
}: {
  video: CardVideo;
  href?: string;
  priority?: boolean;
  /** Style tile only: render the hover state. */
  forceHover?: boolean;
}) {
  return (
    <article className={`group ${forceHover ? "is-hover" : ""}`}>
      <Link href={href ?? `/watch/${video.id}`} className="block rounded-[var(--radius-thumb)] outline-offset-4">
        <Thumbnail video={video} sizes={GRID_SIZES} priority={priority} />
        <div className="mt-3 flex gap-3">
          <ChannelAvatar name={video.channel.name} />
          <div className="min-w-0 flex-1">
            <h3 className="type-title line-clamp-2 text-fg">{video.title}</h3>
            <p className="type-meta mt-1 truncate text-fg-muted transition-colors group-hover:text-fg group-[.is-hover]:text-fg">
              {video.channel.name}
            </p>
            <MetaLine video={video} />
          </div>
        </div>
      </Link>
    </article>
  );
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** "241K views", "1 view". */
export function formatViews(views: number) {
  return `${compact.format(views)} ${views === 1 ? "view" : "views"}`;
}

export function MetaLine({ video }: { video: CardVideo }) {
  const parts = [video.published ? formatViews(video.views) : null, video.published].filter(Boolean);
  if (!parts.length && !video.isMembersOnly) return null;
  return (
    <p className="type-meta flex items-center gap-1 text-fg-faint">
      {video.isMembersOnly && (
        <span className="inline-flex shrink-0 items-center" title="Members only">
          <LockIcon className="size-3" />
          <span className="sr-only">Members only</span>
        </span>
      )}
      <span className="truncate">{parts.join(" · ")}</span>
    </p>
  );
}

export function Thumbnail({
  video,
  sizes,
  priority,
  className = "",
}: {
  video: CardVideo;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative aspect-video overflow-hidden rounded-[var(--radius-thumb)] bg-raised ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit renders each srcset width; next/image would re-process (and break signed URLs) */}
      <img
        src={video.thumb.src}
        srcSet={video.thumb.srcSet}
        sizes={sizes}
        alt=""
        width={640}
        height={360}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] group-[.is-hover]:scale-[1.03]"
      />
      {/* Hairline border drawn above the image so it stays crisp on bright frames. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.07]" />
      <TimecodeBadge duration={video.duration} />
      <span aria-hidden className="playhead w-0 group-hover:w-[32%] group-[.is-hover]:w-[32%]" />
    </div>
  );
}

export function TimecodeBadge({ duration }: { duration: string | null }) {
  return (
    <span className="type-timecode absolute bottom-2 right-2 rounded-[var(--radius-chip)] bg-black/75 px-1.5 py-0.5 text-fg backdrop-blur-sm">
      {duration ?? "--:--"}
    </span>
  );
}

export function ChannelAvatar({ name, size = "size-9" }: { name: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-surface text-[13px] font-semibold uppercase text-fg transition-colors group-hover:bg-raised`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function LockIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
    </svg>
  );
}
