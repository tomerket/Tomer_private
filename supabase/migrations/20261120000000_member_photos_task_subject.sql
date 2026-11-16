-- Face photo per family member (cropped square, private bucket)
alter table public.members add column photo_path text;

-- Parents tasks: subject + description; start and end dates both required
alter table public.parent_tasks add column subject text;
update public.parent_tasks set subject = left(btrim(text), 80) where subject is null;
update public.parent_tasks set due_date = day where due_date is null;
alter table public.parent_tasks alter column subject set not null;
alter table public.parent_tasks add constraint parent_tasks_subject_check check (length(btrim(subject)) between 1 and 80);
alter table public.parent_tasks alter column due_date set not null;
alter table public.parent_tasks drop constraint parent_tasks_text_check;
alter table public.parent_tasks alter column text drop not null;
alter table public.parent_tasks add constraint parent_tasks_text_check check (text is null or length(text) <= 1000);
comment on column public.parent_tasks.text is 'Description (optional)';
comment on column public.parent_tasks.due_date is 'End date';

-- Read for 20 minutes uses the stack-of-books picture
update public.kid_task_templates set icon = 'books' where title = 'Read for 20 minutes';
