-- Which kids a task is for: NULL = all kids in the family
alter table public.kid_task_templates add column member_ids uuid[];

-- Daily rewards: earned when a kid ticks at least min_score tasks in a day
create table public.kid_rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  min_score smallint not null check (min_score between 1 and 100),
  member_ids uuid[], -- NULL = all kids
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index kid_rewards_family_idx on public.kid_rewards (family_id);
alter table public.kid_rewards enable row level security;
