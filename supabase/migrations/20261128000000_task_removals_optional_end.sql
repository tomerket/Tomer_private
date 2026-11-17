-- When a kids task is taken away from one kid, remember the day: the Dashboard keeps that
-- kid's history before it and stops counting the task from that day on.
create table public.kid_task_removals (
  template_id integer not null references public.kid_task_templates(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  removed_on date not null,
  primary key (template_id, member_id)
);
alter table public.kid_task_removals enable row level security;

-- Parents tasks: the end date is optional again (open-ended tasks)
alter table public.parent_tasks alter column due_date drop not null;
