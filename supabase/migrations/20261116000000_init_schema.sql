-- MyFamily initial schema (applied to Supabase project xhfklcgkohizqphnigua)

-- Families: one per admin account
create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_name text not null check (length(btrim(family_name)) between 1 and 60),
  admin_name text not null check (length(btrim(admin_name)) between 1 and 60),
  photo_path text,
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index families_name_admin_uq
  on public.families (lower(btrim(family_name)), lower(btrim(admin_name)));

-- Members of a family (kids and parents). The admin is also a member.
create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  role text not null check (role in ('kid', 'parent')),
  birthday date not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index members_family_name_uq on public.members (family_id, lower(btrim(name)));

-- Default daily kids tasks
create table public.kid_task_templates (
  id smallint generated always as identity primary key,
  title text not null,
  icon text not null,
  sort_order smallint not null,
  active boolean not null default true
);

-- "kid X did task Y on day Z"
create table public.kid_task_checks (
  member_id uuid not null references public.members(id) on delete cascade,
  template_id smallint not null references public.kid_task_templates(id) on delete cascade,
  day date not null,
  checked_by uuid references public.members(id) on delete set null,
  checked_at timestamptz not null default now(),
  primary key (member_id, template_id, day)
);
create index kid_task_checks_checked_by_idx on public.kid_task_checks (checked_by);
create index kid_task_checks_template_idx on public.kid_task_checks (template_id);

-- Free-text tasks for parents/adults
create table public.parent_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references public.members(id) on delete set null,
  assigned_to uuid references public.members(id) on delete set null,
  text text not null check (length(btrim(text)) between 1 and 500),
  day date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index parent_tasks_family_day_idx on public.parent_tasks (family_id, day);
create index parent_tasks_created_by_idx on public.parent_tasks (created_by);
create index parent_tasks_assigned_to_idx on public.parent_tasks (assigned_to);

-- Failed member-login attempts (simple brute-force protection)
create table public.member_login_failures (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index member_login_failures_family_time_idx on public.member_login_failures (family_id, created_at);

-- RLS on everywhere, no policies: browser roles get nothing.
-- All data access goes through the Node API using the secret key.
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.kid_task_templates enable row level security;
alter table public.kid_task_checks enable row level security;
alter table public.parent_tasks enable row level security;
alter table public.member_login_failures enable row level security;

-- Atomic onboarding: family + members in one transaction
create or replace function public.create_family(
  p_owner uuid, p_family_name text, p_admin_name text, p_members jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_family uuid;
  m jsonb;
begin
  insert into public.families (family_name, admin_name, owner_user_id)
  values (btrim(p_family_name), btrim(p_admin_name), p_owner)
  returning id into v_family;

  for m in select * from jsonb_array_elements(p_members) loop
    insert into public.members (family_id, name, role, birthday, is_admin)
    values (v_family, btrim(m->>'name'), m->>'role', (m->>'birthday')::date,
            coalesce((m->>'is_admin')::boolean, false));
  end loop;

  return v_family;
end;
$$;
revoke all on function public.create_family(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_family(uuid, text, text, jsonb) to service_role;

-- Private bucket for family photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-photos', 'family-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- Seed the default kids tasks
insert into public.kid_task_templates (title, icon, sort_order) values
  ('Make my bed', '🛏️', 1),
  ('Brush my teeth (morning)', '🪥', 2),
  ('Get dressed', '👕', 3),
  ('Eat breakfast', '🥣', 4),
  ('Pack my school bag', '🎒', 5),
  ('Do my homework', '📚', 6),
  ('Read for 20 minutes', '📖', 7),
  ('Clean my room', '🧸', 8),
  ('Help set the table', '🍽️', 9),
  ('Feed the pet / water the plants', '🪴', 10),
  ('Put clothes in the hamper', '🧺', 11),
  ('Take a shower', '🛁', 12),
  ('Brush my teeth (evening)', '🦷', 13),
  ('Put on pajamas', '🌙', 14);
