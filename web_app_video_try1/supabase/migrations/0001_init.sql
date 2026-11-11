-- Screening Room: core schema, access helpers, and row level security.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- Profiles -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('creator', 'viewer')),
  created_at timestamptz not null default now()
);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Members --------------------------------------------------------------------

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Channels -------------------------------------------------------------------

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  handle text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Videos ---------------------------------------------------------------------

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  title text not null,
  description text not null default '',
  ik_file_id text not null unique,
  ik_file_path text not null unique,
  ik_url text not null,
  duration_seconds numeric,
  thumbnail_offset numeric not null default 0 check (thumbnail_offset >= 0),
  is_published boolean not null default false,
  is_members_only boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_channel_id_idx on public.videos (channel_id);
create index videos_feed_idx on public.videos (published_at desc) where is_published;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function private.touch_updated_at();

-- Playlists ------------------------------------------------------------------

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create index playlists_channel_id_idx on public.playlists (channel_id);

create table public.playlist_items (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  position integer not null,
  primary key (playlist_id, video_id)
);

create index playlist_items_video_id_idx on public.playlist_items (video_id);

-- Access helpers (private schema: usable in policies, not exposed as RPC) ------

create function private.is_creator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'creator'
  );
$$;

create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members where user_id = (select auth.uid())
  );
$$;

create function private.owns_channel(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    join public.profiles p on p.id = c.owner_id
    where c.id = cid and c.owner_id = (select auth.uid()) and p.role = 'creator'
  );
$$;

grant execute on function private.is_creator() to anon, authenticated;
grant execute on function private.is_member() to anon, authenticated;
grant execute on function private.owns_channel(uuid) to anon, authenticated;

-- Public RPC used by /api/sign: may the current caller stream this file?
create function public.can_stream(p_file_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.ik_file_path = p_file_path
      and (
        private.owns_channel(v.channel_id)
        or (v.is_published and (not v.is_members_only or private.is_member()))
      )
  );
$$;

revoke execute on function public.can_stream(text) from public;
grant execute on function public.can_stream(text) to anon, authenticated;

-- Row level security ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;

-- profiles: read your own row. No update policy, so nobody can change their role.
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- members: read your own row. Membership is granted by SQL in the dashboard.
create policy "members: read own"
  on public.members for select
  to authenticated
  using (user_id = (select auth.uid()));

-- channels: public channel info; creators manage their own channel.
create policy "channels: public read"
  on public.channels for select
  to anon, authenticated
  using (true);

create policy "channels: creator insert"
  on public.channels for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and private.is_creator());

create policy "channels: owner update"
  on public.channels for update
  to authenticated
  using (private.owns_channel(id))
  with check (private.owns_channel(id));

-- videos: published metadata is public (members-only streams are gated by can_stream).
create policy "videos: read published or own"
  on public.videos for select
  to anon, authenticated
  using (is_published or private.owns_channel(channel_id));

create policy "videos: owner insert"
  on public.videos for insert
  to authenticated
  with check (private.owns_channel(channel_id));

create policy "videos: owner update"
  on public.videos for update
  to authenticated
  using (private.owns_channel(channel_id))
  with check (private.owns_channel(channel_id));

create policy "videos: owner delete"
  on public.videos for delete
  to authenticated
  using (private.owns_channel(channel_id));

-- playlists
create policy "playlists: read published or own"
  on public.playlists for select
  to anon, authenticated
  using (is_published or private.owns_channel(channel_id));

create policy "playlists: owner insert"
  on public.playlists for insert
  to authenticated
  with check (private.owns_channel(channel_id));

create policy "playlists: owner update"
  on public.playlists for update
  to authenticated
  using (private.owns_channel(channel_id))
  with check (private.owns_channel(channel_id));

create policy "playlists: owner delete"
  on public.playlists for delete
  to authenticated
  using (private.owns_channel(channel_id));

-- playlist_items follow their playlist
create policy "playlist_items: read if playlist visible"
  on public.playlist_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
        and (p.is_published or private.owns_channel(p.channel_id))
    )
  );

create policy "playlist_items: owner write"
  on public.playlist_items for all
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
