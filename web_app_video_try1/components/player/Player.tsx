"use client";

import "@imagekit/video-player/styles.css";
import type { IKPlayerOptions, Player as IKPlayer, SourceOptions } from "@imagekit/video-player";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { IMAGEKIT_ID, PLAYER_ANALYTICS, SIGNED_DELIVERY } from "@/lib/env";
import { signedUrl } from "@/lib/sign-client";
import { recordWatch } from "@/app/watch/actions";

export type PlayerProps = {
  /** Our video id, for watch-time reporting. */
  videoId: string;
  src: string;
  title: string;
  description: string;
  poster: string;
  /** Where to go when the video ends (next item in a playlist). */
  nextHref?: string;
  viewerId?: string;
};

/**
 * All ImageKit player code lives here. We use the vanilla `videoPlayer()` API
 * instead of the bundled React wrapper because the wrapper reuses one <video>
 * element across dispose/re-init (breaks under React Strict Mode) and ignores
 * source changes. Here each mount creates and owns a fresh element.
 */
export function Player({ videoId, src, title, description, poster, nextHref, viewerId }: PlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const nextRef = useRef(nextHref);

  useEffect(() => {
    nextRef.current = nextHref;
  }, [nextHref]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let player: IKPlayer | null = null;
    let cancelled = false;

    const video = document.createElement("video");
    video.className = "video-js";
    video.setAttribute("playsinline", "");
    video.setAttribute("controls", "");
    host.appendChild(video);

    const ikOptions: IKPlayerOptions = {
      imagekitId: IMAGEKIT_ID,
      seekThumbnails: true,
      floatingWhenNotVisible: "right",
      hideContextMenu: true,
      abs: { protocol: "hls", sr: [360, 480, 720, 1080] },
      ...(SIGNED_DELIVERY ? { signerFn: signedUrl } : {}),
      ...(PLAYER_ANALYTICS ? { analytics: { enabled: true, userId: viewerId } } : {}),
    };

    const source: SourceOptions = {
      src,
      chapters: true,
      info: { title, description },
      poster: { src: poster },
    };

    void import("@imagekit/video-player").then(({ videoPlayer }) => {
      if (cancelled) return;
      player = videoPlayer(video, ikOptions, {
        fluid: true,
        aspectRatio: "16:9",
        controls: true,
        preload: "auto",
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      });
      player.src(source);

      // Watch time: count only seconds that actually played (not seeks).
      player.on("timeupdate", () => {
        const t = player?.currentTime() ?? 0;
        if (player && !player.paused() && lastTime !== null) {
          const delta = t - lastTime;
          if (delta > 0 && delta < 2) pending += delta;
        }
        lastTime = t;
        if (t > furthest) furthest = t;
      });
      player.on("seeking", () => {
        lastTime = null;
      });
      player.on("pause", flush);
      player.on("ended", () => {
        flush();
        if (nextRef.current) router.push(nextRef.current);
      });
    });

    let pending = 0;
    let furthest = 0;
    let lastTime: number | null = null;
    function flush() {
      if (pending < 1) return;
      const seconds = pending;
      pending = 0;
      void recordWatch(videoId, seconds, furthest);
    }
    const heartbeat = window.setInterval(flush, 15_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      flush();
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      if (player) player.dispose();
      else video.remove();
    };
  }, [videoId, src, title, description, poster, viewerId, router]);

  return <div ref={hostRef} className="sr-player overflow-hidden rounded-[var(--radius-thumb)] bg-black" />;
}
