"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer, requireCreatorChannel } from "@/lib/auth";
import { IMAGEKIT_URL_ENDPOINT, VIDEO_FOLDER } from "@/lib/env";
import { imagekit } from "@/lib/imagekit.server";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong. Try again." };
}

function refreshViewerPages() {
  updateTag("videos");
  updateTag("playlists");
}

// Channel ---------------------------------------------------------------------

export async function createChannel(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer?.isCreator) return { ok: false, error: "Studio access requires a creator account." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Channel name needs at least 2 characters." };
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "channel";

  const supabase = await createClient();
  const { error } = await supabase.from("channels").insert({ owner_id: viewer.id, name, handle });
  if (error) return { ok: false, error: error.code === "23505" ? "That channel name is taken." : error.message };

  refreshViewerPages();
  return { ok: true };
}

// Videos ----------------------------------------------------------------------

export type UploadedFile = {
  fileId: string;
  filePath: string;
  url: string;
  name: string;
  duration?: number | null;
};

export async function createVideo(file: UploadedFile): Promise<ActionResult> {
  try {
    const { channel } = await requireCreatorChannel();
    if (!file.filePath.startsWith(`${VIDEO_FOLDER}/`) || !file.url.startsWith(IMAGEKIT_URL_ENDPOINT)) {
      return { ok: false, error: "Upload did not land in the videos folder." };
    }

    let duration = file.duration ?? null;
    if (duration == null) {
      try {
        duration = (await imagekit().files.get(file.fileId)).duration ?? null;
      } catch {
        duration = null;
      }
    }

    const title = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled video";
    const supabase = await createClient();
    const { error } = await supabase.from("videos").insert({
      channel_id: channel.id,
      title,
      ik_file_id: file.fileId,
      ik_file_path: file.filePath,
      ik_url: file.url,
      duration_seconds: duration,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setPublished(videoId: string, published: boolean): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { data: current } = await supabase.from("videos").select("published_at").eq("id", videoId).single();
    const { error } = await supabase
      .from("videos")
      .update({
        is_published: published,
        published_at: published ? (current?.published_at ?? new Date().toISOString()) : current?.published_at,
      })
      .eq("id", videoId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setMembersOnly(videoId: string, membersOnly: boolean): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { error } = await supabase.from("videos").update({ is_members_only: membersOnly }).eq("id", videoId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateVideoDetails(videoId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!title) return { ok: false, error: "Add a title." };
    const supabase = await createClient();
    const { error } = await supabase.from("videos").update({ title, description }).eq("id", videoId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setThumbnailOffset(videoId: string, offset: number): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    if (!Number.isFinite(offset) || offset < 0) return { ok: false, error: "Pick a frame inside the video." };
    const supabase = await createClient();
    const { error } = await supabase.from("videos").update({ thumbnail_offset: Math.floor(offset) }).eq("id", videoId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setVideoPlaylists(videoId: string, playlistIds: string[]): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { data: existing, error: readError } = await supabase
      .from("playlist_items")
      .select("playlist_id")
      .eq("video_id", videoId);
    if (readError) return { ok: false, error: readError.message };

    const current = new Set((existing ?? []).map((row) => row.playlist_id));
    const wanted = new Set(playlistIds);
    const toRemove = [...current].filter((id) => !wanted.has(id));
    const toAdd = [...wanted].filter((id) => !current.has(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from("playlist_items")
        .delete()
        .eq("video_id", videoId)
        .in("playlist_id", toRemove);
      if (error) return { ok: false, error: error.message };
    }
    for (const playlistId of toAdd) {
      const result = await appendToPlaylist(playlistId, videoId);
      if (!result.ok) return result;
    }
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// Playlists -------------------------------------------------------------------

async function appendToPlaylist(playlistId: string, videoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("playlist_items")
    .insert({ playlist_id: playlistId, video_id: videoId, position: (last?.position ?? -1) + 1 });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createPlaylist(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let newId: string;
  try {
    const { channel } = await requireCreatorChannel();
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { ok: false, error: "Give the playlist a name." };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("playlists")
      .insert({ channel_id: channel.id, title })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    newId = data.id;
  } catch (error) {
    return fail(error);
  }
  redirect(`/studio/playlists/${newId}`);
}

export async function updatePlaylist(playlistId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!title) return { ok: false, error: "Give the playlist a name." };
    const supabase = await createClient();
    const { error } = await supabase.from("playlists").update({ title, description }).eq("id", playlistId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setPlaylistPublished(playlistId: string, published: boolean): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { error } = await supabase.from("playlists").update({ is_published: published }).eq("id", playlistId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePlaylist(playlistId: string): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
  } catch (error) {
    return fail(error);
  }
  redirect("/studio/playlists");
}

export async function addPlaylistItem(playlistId: string, videoId: string): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const result = await appendToPlaylist(playlistId, videoId);
    if (result.ok) refreshViewerPages();
    return result;
  } catch (error) {
    return fail(error);
  }
}

export async function removePlaylistItem(playlistId: string, videoId: string): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const { error } = await supabase
      .from("playlist_items")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("video_id", videoId);
    if (error) return { ok: false, error: error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Writes positions 0..n-1 in the given order. */
export async function reorderPlaylist(playlistId: string, orderedVideoIds: string[]): Promise<ActionResult> {
  try {
    await requireCreatorChannel();
    const supabase = await createClient();
    const results = await Promise.all(
      orderedVideoIds.map((videoId, position) =>
        supabase.from("playlist_items").update({ position }).eq("playlist_id", playlistId).eq("video_id", videoId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: failed.error.message };
    refreshViewerPages();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
