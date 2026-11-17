-- A parents task can show a picture from the built-in gallery (or a photo, photo_path)
alter table public.parent_tasks add column icon text check (icon is null or icon ~ '^[a-z0-9-]{1,30}$');
