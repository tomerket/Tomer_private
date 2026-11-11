-- Advisor fixes after 0001.

-- Supabase's automatic-RLS event trigger function should not be callable via the API.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- Split the playlist_items "for all" policy so SELECT has a single permissive policy.
drop policy "playlist_items: owner write" on public.playlist_items;

create policy "playlist_items: owner insert"
  on public.playlist_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and private.owns_channel(p.channel_id)
    )
  );

create policy "playlist_items: owner update"
  on public.playlist_items for update
  to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and private.owns_channel(p.channel_id)
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and private.owns_channel(p.channel_id)
    )
  );

create policy "playlist_items: owner delete"
  on public.playlist_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and private.owns_channel(p.channel_id)
    )
  );

-- can_stream stays executable by anon on purpose: anonymous viewers stream public
-- videos through /api/sign, and the function only answers yes/no for one file path.
comment on function public.can_stream(text) is
  'Intentionally public: returns whether the caller may stream the given ImageKit file path.';
