-- Parents tasks have 3 statuses: Open (default), In progress, Done.
-- "done" stays as it was; in_progress marks an open task that someone has started.
alter table public.parent_tasks add column in_progress boolean not null default false;
comment on column public.parent_tasks.in_progress is 'Status: done = Done; otherwise in_progress = In progress, else Open';
