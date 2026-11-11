import { revalidateTag } from "next/cache";

/**
 * Expires the public catalog cache after out-of-band data changes (the demo
 * seed script writes straight to the database). Protected by REVALIDATE_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return new Response("Not allowed", { status: 403 });
  }
  revalidateTag("videos", { expire: 0 });
  revalidateTag("playlists", { expire: 0 });
  return Response.json({ revalidated: ["videos", "playlists"] });
}
