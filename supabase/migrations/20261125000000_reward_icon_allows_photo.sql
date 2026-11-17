-- A reward picture can be a built-in picture name or a photo the family uploaded (https link)
alter table public.kid_rewards drop constraint if exists kid_rewards_icon_check;
alter table public.kid_rewards add constraint kid_rewards_icon_check check (icon ~ '^[a-z0-9-]{1,30}$' or icon like 'https://%');
