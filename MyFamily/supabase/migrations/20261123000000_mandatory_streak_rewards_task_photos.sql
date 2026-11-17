-- Must-do kids tasks
alter table public.kid_task_templates add column mandatory boolean not null default false;

-- Rewards: "daily" (score per day) or "streak" (one task done N days in a row), with a picture
alter table public.kid_rewards
  add column kind text not null default 'daily' check (kind in ('daily', 'streak')),
  add column task_id integer references public.kid_task_templates(id) on delete cascade,
  add column streak_days smallint check (streak_days between 2 and 60),
  add column icon text not null default 'gift' check (icon ~ '^[a-z0-9-]{1,30}$');
alter table public.kid_rewards alter column min_score drop not null;
alter table public.kid_rewards add constraint kid_rewards_kind_fields check (
  (kind = 'daily' and min_score is not null) or
  (kind = 'streak' and task_id is not null and streak_days is not null)
);
create index kid_rewards_task_idx on public.kid_rewards (task_id);

-- Optional photo on a parents task (private bucket)
alter table public.parent_tasks add column photo_path text;
