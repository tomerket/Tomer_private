import { IMAGEKIT_URL_ENDPOINT } from "@/lib/env";

/** Base delivery URL for a media-library path, without query strings. */
export function mediaUrl(filePath: string) {
  return `${IMAGEKIT_URL_ENDPOINT}${filePath}`;
}

/** A still frame from the video at `offset` seconds, `width` pixels wide. */
export function thumbUrl(filePath: string, offset: number, width: number) {
  const so = Math.max(0, Math.floor(offset));
  return `${mediaUrl(filePath)}/ik-thumbnail.jpg?tr=so-${so},w-${width}`;
}

export const THUMB_WIDTHS = [320, 480, 640, 960] as const;

/**
 * Extracts the media-library file path (e.g. "/videos/clip_abc.mp4") from any
 * delivery URL the player may request: the video itself, ik-master.m3u8,
 * ik-thumbnail.jpg, seek-thumbnail sprites, chapter or subtitle files, with or
 * without a "tr:" path segment.
 */
export function filePathFromDeliveryUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const endpoint = new URL(IMAGEKIT_URL_ENDPOINT);
  if (parsed.origin !== endpoint.origin) return null;
  if (!parsed.pathname.startsWith(`${endpoint.pathname}/`)) return null;

  const segments = parsed.pathname
    .slice(endpoint.pathname.length)
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("tr:"));

  const videoIndex = segments.findIndex((segment) => /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(segment));
  if (videoIndex === -1) return null;
  return `/${segments.slice(0, videoIndex + 1).map(decodeURIComponent).join("/")}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
