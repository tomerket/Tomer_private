-- Family calendar: activities and date reminders
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  day date not null,
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note text check (note is null or char_length(note) <= 500),
  remind_on date, -- the day the family is reminded (on or before the activity)
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  check (remind_on is null or remind_on <= day)
);
create index calendar_events_family_day on public.calendar_events (family_id, day);
alter table public.calendar_events enable row level security;

-- Shopping list (wish list style): products grouped by category
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  bought boolean not null default false,
  bought_at timestamptz,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index shopping_items_family on public.shopping_items (family_id, category);
alter table public.shopping_items enable row level security;
-- RLS on with no policies: only the server (secret key) can read or write.
