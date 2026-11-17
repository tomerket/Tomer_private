-- Sharing for calendar activities and shopping products.
-- shared_with: null = the whole family; an array = only the creator plus those members
-- (an empty array = only the creator). Existing rows stay null, so nothing disappears.
alter table public.calendar_events add column shared_with uuid[];
alter table public.shopping_items add column shared_with uuid[];
