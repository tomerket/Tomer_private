-- Parents tasks: "day" is the start date; add an optional due date and when it was completed
alter table public.parent_tasks
  add column due_date date,
  add column done_at timestamptz;
alter table public.parent_tasks
  add constraint parent_tasks_due_after_start check (due_date is null or due_date >= day);
comment on column public.parent_tasks.day is 'Start date';
create index parent_tasks_family_done_idx on public.parent_tasks (family_id, done);

-- "Pack my school bag" belongs to the evening (defaults and existing families)
update public.kid_task_templates set period = 'evening' where title = 'Pack my school bag' and archived_at is null;

-- New pictures: cleaning tools and pajamas (the moon now marks the Evening section)
update public.kid_task_templates set icon = 'cleaning' where title = 'Clean my room';
update public.kid_task_templates set icon = 'pajamas' where title = 'Put on pajamas';
