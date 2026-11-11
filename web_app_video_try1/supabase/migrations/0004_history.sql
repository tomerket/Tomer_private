-- Watch history: signed-in viewers can read their own view records
-- (viewer_key is their user id). Anonymous cookie keys stay unreadable.
create policy "video_views: read own history"
  on public.video_views for select
  to authenticated
  using (viewer_key = (select auth.uid())::text);

create index video_views_viewer_idx on public.video_views (viewer_key, day desc);
