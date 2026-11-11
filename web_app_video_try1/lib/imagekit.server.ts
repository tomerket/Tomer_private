import "server-only";
import ImageKit from "@imagekit/nodejs";
import { IMAGEKIT_URL_ENDPOINT, SIGNED_DELIVERY } from "@/lib/env";
import { THUMB_WIDTHS, thumbUrl } from "@/lib/imagekit";

const client = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY });

export function imagekit() {
  return client;
}

/** Signs an absolute ImageKit delivery URL. */
export function signUrl(url: string, expiresInSeconds: number) {
  return client.helper.buildSrc({ src: url, urlEndpoint: IMAGEKIT_URL_ENDPOINT, expiresIn: expiresInSeconds });
}

/**
 * Thumbnail URLs are signed with an expiry aligned to a 6-hour bucket (valid for
 * 6 to 12 hours), so the same URL is produced for a while and stays cacheable.
 */
function bucketedExpiry() {
  const bucket = 6 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = (Math.floor(now / bucket) + 2) * bucket;
  return expiresAt - now;
}

export function deliverThumb(filePath: string, offset: number, width: number) {
  const url = thumbUrl(filePath, offset, width);
  return SIGNED_DELIVERY ? signUrl(url, bucketedExpiry()) : url;
}

export type ThumbSet = { src: string; srcSet: string };

export function thumbSet(filePath: string, offset: number): ThumbSet {
  const urls = THUMB_WIDTHS.map((w) => [w, deliverThumb(filePath, offset, w)] as const);
  return {
    src: urls[2][1],
    srcSet: urls.map(([w, url]) => `${url} ${w}w`).join(", "),
  };
}
