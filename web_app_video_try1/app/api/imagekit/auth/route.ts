import { getUploadAuthParams } from "@imagekit/next/server";
import { getViewer } from "@/lib/auth";

/** Short-lived upload credentials, only for the creator. One token per upload. */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer?.isCreator || !viewer.channel) {
    return Response.json({ error: "Studio access requires a creator account." }, { status: 403 });
  }

  const auth = getUploadAuthParams({
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  });
  return Response.json(auth, { headers: { "Cache-Control": "no-store" } });
}
