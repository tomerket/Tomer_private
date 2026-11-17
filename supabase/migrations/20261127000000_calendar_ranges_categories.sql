-- Calendar: activities can span several days, reminders get a time, activities get a category
alter table public.calendar_events
  add column end_day date,
  add column remind_time text check (remind_time is null or remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column category text check (category is null or char_length(category) between 1 and 30),
  add constraint calendar_events_end_after_start check (end_day is null or end_day >= day);

-- Categories a family added by hand (built-in ones live in the code)
create table public.family_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('shopping', 'calendar')),
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
create unique index family_categories_unique on public.family_categories (family_id, kind, lower(name));
alter table public.family_categories enable row level security;
