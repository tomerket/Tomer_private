-- Per-family kids tasks with Morning / General / Evening periods and picture icons.
-- Applied after clearing all test data (no existing families to migrate).

-- Bigger ids (one set of tasks per family)
alter table public.kid_task_checks drop constraint kid_task_checks_template_id_fkey;
alter table public.kid_task_templates alter column id type integer;
alter table public.kid_task_checks alter column template_id type integer;
alter table public.kid_task_checks
  add constraint kid_task_checks_template_id_fkey foreign key (template_id)
  references public.kid_task_templates(id) on delete cascade;

-- Rows with family_id NULL are the global defaults copied into each new family.
alter table public.kid_task_templates
  add column family_id uuid references public.families(id) on delete cascade,
  add column period text not null default 'general' check (period in ('morning', 'general', 'evening')),
  add column created_at timestamptz not null default now(),
  add column archived_at timestamptz;
create index kid_task_templates_family_idx on public.kid_task_templates (family_id);
comment on column public.kid_task_templates.active is 'Unused; replaced by archived_at';

-- Defaults: picture keys + period
update public.kid_task_templates as t set icon = v.icon, period = v.period
from (values
  (1, 'bed', 'morning'), (2, 'toothbrush', 'morning'), (3, 'tshirt', 'morning'),
  (4, 'breakfast', 'morning'), (5, 'backpack', 'morning'),
  (6, 'pencil', 'general'), (7, 'openbook', 'general'), (8, 'teddy', 'general'),
  (9, 'plate', 'general'), (10, 'plant', 'general'), (11, 'basket', 'general'),
  (12, 'shower', 'evening'), (13, 'tooth', 'evening'), (14, 'moon', 'evening')
) as v(sort_order, icon, period)
where t.family_id is null and t.sort_order = v.sort_order;

-- New families get their own copy of the defaults
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

  insert into public.kid_task_templates (family_id, title, icon, sort_order, period)
  select v_family, title, icon, sort_order, period
  from public.kid_task_templates where family_id is null;

  return v_family;
end;
$$;
revoke all on function public.create_family(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_family(uuid, text, text, jsonb) to service_role;
