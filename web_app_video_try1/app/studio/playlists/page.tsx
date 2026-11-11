import type { Metadata } from "next";
import Link from "next/link";
import { StudioGate } from "../StudioGate";
import { createClient } from "@/lib/supabase/server";
import { NewPlaylistForm } from "./NewPlaylistForm";

export const metadata: Metadata = { title: "Playlists" };

export default function StudioPlaylistsPage() {
  return (
    <section className="pt-8">
      <h1 className="type-display">Playlists</h1>
      <p className="mt-1 type-body text-fg-muted">Group videos into an order viewers can play straight through.</p>
      <StudioGate>
        {({ channel }) => (
          <>
            <NewPlaylistForm />
            <PlaylistList channelId={channel.id} />
          </>
        )}
      </StudioGate>
    </section>
  );
}

async function PlaylistList({ channelId }: { channelId: string }) {
  const supabase = await createClient();
  const { data: playlists } = await supabase
    .from("playlists")
    .select("id, title, is_published, playlist_items(count)")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });

  return (
    <>
      {playlists?.length ? (
        <ul className="mt-8 divide-y divide-line/70 border-y border-line/70">
          {playlists.map((playlist) => {
            const count = playlist.playlist_items[0]?.count ?? 0;
            return (
              <li key={playlist.id}>
                <Link
                  href={`/studio/playlists/${playlist.id}`}
                  className="flex items-center justify-between gap-4 px-1 py-4 hover:bg-surface/60"
                >
                  <span className="font-medium">{playlist.title}</span>
                  <span className="flex items-center gap-4 text-sm text-fg-muted">
                    <span>{count === 1 ? "1 video" : `${count} videos`}</span>
                    <span className={playlist.is_published ? "text-fg" : ""}>{playlist.is_published ? "Live" : "Draft"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-fg-muted">No playlists yet. Name one above to create it.</p>
      )}
    </>
  );
}
