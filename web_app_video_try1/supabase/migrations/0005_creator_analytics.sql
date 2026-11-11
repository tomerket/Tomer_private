-- Creator analytics: aggregates for the caller's own channel only.
-- Raw view/subscription rows stay private; these return counts.

create function public.creator_daily_views(p_days integer default 28)
returns table (day date, views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select v.id from public.videos v
    join public.channels c on c.id = v.channel_id
    where c.owner_id = (select auth.uid())
  ),
  days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as day
  )
  select d.day, count(vv.video_id)::bigint as views
  from days d
  left join public.video_views vv on vv.day = d.day and vv.video_id in (select id from mine)
  group by d.day
  order by d.day;
$$;

create function public.creator_daily_subscribers(p_days integer default 28)
returns table (day date, gained bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select id from public.channels where owner_id = (select auth.uid())
  ),
  days as (
    select generate_series(current_date - (least(greatest(p_days, 1), 365) - 1), current_date, interval '1 day')::date as day
  )
  select d.day, count(s.user_id)::bigint as gained
  from days d
  left join public.subscriptions s on s.created_at::date = d.day and s.channel_id in (select id from mine)
  group by d.day
  order by d.day;
$$;

create function public.creator_video_analytics(p_days integer default 28)
returns table (
  video_id uuid,
  title text,
  is_published boolean,
  published_at timestamptz,
  views_total bigint,
  views_period bigint,
  likes integer,
  dislikes integer,
  comments integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.title, v.is_published, v.published_at,
    coalesce(s.views, 0),
    (select count(*) from public.video_views vv
       where vv.video_id = v.id and vv.day > current_date - least(greatest(p_days, 1), 365)),
    coalesce(s.likes, 0), coalesce(s.dislikes, 0), coalesce(s.comments, 0)
  from public.videos v
  join public.channels c on c.id = v.channel_id
  left join public.video_stats s on s.video_id = v.id
  where c.owner_id = (select auth.uid())
  order by coalesce(s.views, 0) desc, v.created_at desc;
$$;

revoke execute on function public.creator_daily_views(integer) from public, anon;
revoke execute on function public.creator_daily_subscribers(integer) from public, anon;
revoke execute on function public.creator_video_analytics(integer) from public, anon;
grant execute on function public.creator_daily_views(integer) to authenticated;
grant execute on function public.creator_daily_subscribers(integer) to authenticated;
grant execute on function public.creator_video_analytics(integer) to authenticated;
