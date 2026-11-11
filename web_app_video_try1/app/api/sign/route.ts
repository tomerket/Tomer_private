import { filePathFromDeliveryUrl } from "@/lib/imagekit";
import { signUrl } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * signerFn endpoint for the ImageKit player (and studio frame previews).
 * Contract: POST { url } -> signed URL as plain text.
 *
 * Signs only URLs that belong to a video the caller may watch. can_stream()
 * runs as the caller, so published public videos pass for everyone, members-only
 * videos only for members, and drafts only for the owning creator.
 */
export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return new Response("Expected JSON body { url }", { status: 400 });
  }
  if (typeof url !== "string") return new Response("Expected { url: string }", { status: 400 });

  const filePath = filePathFromDeliveryUrl(url);
  if (!filePath) return new Response("Not an ImageKit video URL for this account", { status: 400 });

  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("can_stream", { p_file_path: filePath });
  if (error) return new Response("Could not check access", { status: 500 });
  if (!allowed) return new Response("Not allowed", { status: 403 });

  return new Response(signUrl(url, SIGNED_URL_TTL_SECONDS), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
