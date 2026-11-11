-- Watch time: seconds actually played and the furthest point reached, per
-- viewer per video per day (on the existing video_views row).

alter table public.video_views
  add column watched_seconds integer not null default 0 check (watched_seconds >= 0),
  add column max_position numeric not null default 0 check (max_position >= 0);

alter table public.video_stats
  add column watch_seconds bigint not null default 0;

-- Called by the player every ~15s while playing, and on pause/end/leave.
-- Seconds per call are capped at 60 so a client can't inflate watch time.
create function public.record_watch(p_video_id uuid, p_anon_key text, p_seconds integer, p_position numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := coalesce((select auth.uid())::text, p_anon_key);
  secs integer := least(greatest(coalesce(p_seconds, 0), 0), 60);
  pos numeric := greatest(coalesce(p_position, 0), 0);
  dur numeric;
  inserted boolean;
begin
  if key is null or not private.video_is_published(p_video_id) then
    return;
  end if;
  select coalesce(duration_seconds, pos) into dur from public.videos where id = p_video_id;
  pos := least(pos, coalesce(dur, pos));

  insert into public.video_views as vv (video_id, viewer_key, watched_seconds, max_position)
  values (p_video_id, key, secs, pos)
  on conflict (video_id, viewer_key, day) do update
    set watched_seconds = vv.watched_seconds + excluded.watched_seconds,
        max_position = greatest(vv.max_position, excluded.max_position)
  returning (xmax = 0) into inserted;

  update public.video_stats
    set watch_seconds = watch_seconds + secs,
        views = views + (case when inserted then 1 else 0 end)
    where video_id = p_video_id;
end;
$$;
revoke execute on function public.record_watch(uuid, text, integer, numeric) from public;
grant execute on function public.record_watch(uuid, text, integer, numeric) to anon, authenticated;

-- Analytics v2: adds watch time and average percentage watched. New names so
-- nothing is dropped; the v1 functions from 0005 remain but are unused.

create function public.creator_daily_views_v2(p_days integer default 28, p_video_id uuid default null)
returns table (day date, views bigint, watch_seconds bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select v.id from public.videos v
    join public.channels c on c.id = v.channel_id
    where c.owner_id = (select auth.uid())
      and (p_video_id is null or v.id = p_video_id)
  ),
  days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as day
  )
  select d.day, count(vv.video_id)::bigint, coalesce(sum(vv.watched_seconds), 0)::bigint
  from days d
  left join public.video_views vv on vv.day = d.day and vv.video_id in (select id from mine)
  group by d.day
  order by d.day;
$$;

create function public.creator_video_analytics_v2(p_days integer default 28)
returns table (
  video_id uuid,
  title text,
  ik_file_path text,
  thumbnail_offset numeric,
  duration_seconds numeric,
  is_published boolean,
  published_at timestamptz,
  views_total bigint,
  views_period bigint,
  watch_seconds bigint,
  avg_watched_pct numeric,
  likes integer,
  dislikes integer,
  comments integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.ik_file_path, v.thumbnail_offset, v.duration_seconds, v.is_published, v.published_at,
    coalesce(s.views, 0),
    (select count(*) from public.video_views vv
       where vv.video_id = v.id and vv.day > current_date - least(greatest(p_days, 1), 365)),
    coalesce(s.watch_seconds, 0),
    (select round(100 * avg(least(vv.max_position / nullif(v.duration_seconds, 0), 1)), 0)
       from public.video_views vv where vv.video_id = v.id and vv.max_position > 0),
    coalesce(s.likes, 0), coalesce(s.dislikes, 0), coalesce(s.comments, 0)
  from public.videos v
  join public.channels c on c.id = v.channel_id
  left join public.video_stats s on s.video_id = v.id
  where c.owner_id = (select auth.uid())
  order by coalesce(s.views, 0) desc, v.created_at desc;
$$;

revoke execute on function public.creator_daily_views_v2(integer, uuid) from public, anon;
revoke execute on function public.creator_video_analytics_v2(integer) from public, anon;
grant execute on function public.creator_daily_views_v2(integer, uuid) to authenticated;
grant execute on function public.creator_video_analytics_v2(integer) to authenticated;
