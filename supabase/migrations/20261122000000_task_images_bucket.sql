-- Public bucket for pictures parents upload for their own kids tasks (random file names)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-images', 'task-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);
