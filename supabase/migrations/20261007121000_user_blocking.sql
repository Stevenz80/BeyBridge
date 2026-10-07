create table public.user_blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);
create index user_blocks_blocked_user_idx on public.user_blocks (blocked_user_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "users read their own blocks" on public.user_blocks for select to authenticated
using (user_id = (select auth.uid()));
create policy "users block other users" on public.user_blocks for insert to authenticated
with check (user_id = (select auth.uid()) and user_id <> blocked_user_id and not public.account_is_deleting());
create policy "users remove their own blocks" on public.user_blocks for delete to authenticated
using (user_id = (select auth.uid()));

create function public.users_are_blocked(p_other_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_blocks where
    (user_id = (select auth.uid()) and blocked_user_id = p_other_user_id)
    or (blocked_user_id = (select auth.uid()) and user_id = p_other_user_id));
$$;
revoke all on function public.users_are_blocked(uuid) from public, anon;
grant execute on function public.users_are_blocked(uuid) to authenticated;

-- Existing request history remains accessible; prevent new in-app contact
-- in either direction. The prepare trigger supplies the real provider owner.
create policy "blocked users cannot start requests"
on public.service_requests as restrictive for insert to authenticated
with check (not public.users_are_blocked(provider_owner_id));
