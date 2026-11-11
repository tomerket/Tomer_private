-- Engagement: views, likes/dislikes, subscriptions, comments.
-- Added at the owner's request (2026-11-10), reversing the original "no
-- comments / likes / subscriptions / view tracking" scope.
--
-- Counters live in stats tables maintained by triggers, so anyone can read the
-- numbers without being able to read who liked, subscribed or viewed.

-- Helper: is this video visible to the public?
create function private.video_is_published(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.videos where id = vid and is_published);
$$;
grant execute on function private.video_is_published(uuid) to anon, authenticated;

-- Stats ------------------------------------------------------------------------

create table public.video_stats (
  video_id uuid primary key references public.videos (id) on delete cascade,
  views bigint not null default 0,
  likes integer not null default 0,
  dislikes integer not null default 0,
  comments integer not null default 0
);

create table public.channel_stats (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  subscribers integer not null default 0
);

alter table public.video_stats enable row level security;
alter table public.channel_stats enable row level security;

create policy "video_stats: public read for published"
  on public.video_stats for select to anon, authenticated
  using (private.video_is_published(video_id) or exists (
    select 1 from public.videos v where v.id = video_id and private.owns_channel(v.channel_id)
  ));

create policy "channel_stats: public read"
  on public.channel_stats for select to anon, authenticated
  using (true);

-- Rows for existing and future videos/channels.
insert into public.video_stats (video_id) select id from public.videos on conflict do nothing;
insert into public.channel_stats (channel_id) select id from public.channels on conflict do nothing;

create function private.create_video_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.video_stats (video_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger videos_create_stats after insert on public.videos
  for each row execute function private.create_video_stats();

create function private.create_channel_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.channel_stats (channel_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger channels_create_stats after insert on public.channels
  for each row execute function private.create_channel_stats();

-- Views ------------------------------------------------------------------------
-- One view per viewer per video per day. viewer_key is the user id when signed
-- in, otherwise an anonymous cookie id. Written only through record_view().

create table public.video_views (
  video_id uuid not null references public.videos (id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 8 and 64),
  day date not null default current_date,
  primary key (video_id, viewer_key, day)
);
alter table public.video_views enable row level security;
-- No policies: not readable or writable through the API except via record_view().

create function public.record_view(p_video_id uuid, p_anon_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := coalesce((select auth.uid())::text, p_anon_key);
  inserted integer;
begin
  if key is null or not private.video_is_published(p_video_id) then
    return;
  end if;
  insert into public.video_views (video_id, viewer_key)
  values (p_video_id, key)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.video_stats set views = views + 1 where video_id = p_video_id;
  end if;
end;
$$;
revoke execute on function public.record_view(uuid, text) from public;
grant execute on function public.record_view(uuid, text) to anon, authenticated;

-- Likes / dislikes ---------------------------------------------------------------

create table public.video_reactions (
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
create index video_reactions_user_idx on public.video_reactions (user_id);
alter table public.video_reactions enable row level security;

create policy "reactions: read own" on public.video_reactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reactions: add own on published" on public.video_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.video_is_published(video_id));
create policy "reactions: change own" on public.video_reactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.video_is_published(video_id));
create policy "reactions: remove own" on public.video_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create function private.sync_reaction_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.video_stats
      set likes = likes - (old.value = 1)::int, dislikes = dislikes - (old.value = -1)::int
      where video_id = old.video_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.video_stats
      set likes = likes + (new.value = 1)::int, dislikes = dislikes + (new.value = -1)::int
      where video_id = new.video_id;
  end if;
  return null;
end;
$$;
create trigger video_reactions_sync after insert or update or delete on public.video_reactions
  for each row execute function private.sync_reaction_stats();

-- Subscriptions -----------------------------------------------------------------

create table public.subscriptions (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index subscriptions_user_idx on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;

create policy "subscriptions: read own" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "subscriptions: add own" on public.subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "subscriptions: remove own" on public.subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create function private.sync_subscription_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.channel_stats set subscribers = subscribers + 1 where channel_id = new.channel_id;
  else
    update public.channel_stats set subscribers = greatest(subscribers - 1, 0) where channel_id = old.channel_id;
  end if;
  return null;
end;
$$;
create trigger subscriptions_sync after insert or delete on public.subscriptions
  for each row execute function private.sync_subscription_stats();

-- Comments ----------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_video_idx on public.comments (video_id, created_at desc);
create index comments_user_idx on public.comments (user_id);
alter table public.comments enable row level security;

create policy "comments: read on visible videos" on public.comments for select to anon, authenticated
  using (private.video_is_published(video_id) or exists (
    select 1 from public.videos v where v.id = video_id and private.owns_channel(v.channel_id)
  ));
create policy "comments: add own on published" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and private.video_is_published(video_id));
create policy "comments: delete own or as channel owner" on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.videos v where v.id = video_id and private.owns_channel(v.channel_id))
  );

-- Author name is set server-side: the channel name for the channel owner,
-- otherwise the profile display name. Clients cannot choose it.
create function private.set_comment_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_name := coalesce(
    (select c.name from public.channels c join public.videos v on v.channel_id = c.id
      where v.id = new.video_id and c.owner_id = new.user_id),
    (select p.display_name from public.profiles p where p.id = new.user_id),
    'Viewer'
  );
  return new;
end;
$$;
create trigger comments_set_author before insert on public.comments
  for each row execute function private.set_comment_author();

create function private.sync_comment_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.video_stats set comments = comments + 1 where video_id = new.video_id;
  else
    update public.video_stats set comments = greatest(comments - 1, 0) where video_id = old.video_id;
  end if;
  return null;
end;
$$;
create trigger comments_sync after insert or delete on public.comments
  for each row execute function private.sync_comment_stats();
