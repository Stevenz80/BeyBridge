-- Service request coordinates were added after the original column-level insert
-- grant. Without this follow-up grant, requests containing a selected map pin
-- fail at the Postgres privilege layer before the RLS policy is evaluated.
grant insert (
  service_latitude,
  service_longitude
) on public.service_requests to authenticated;

-- Keep the administrator role intentionally limited to the current BeyBridge
-- test administrator. The email sync trigger continues to handle future sign-ins.
delete from private.platform_admin_email_allowlist
where email <> 'stevenoueiss10@gmail.com';

insert into private.platform_admin_email_allowlist (email)
values ('stevenoueiss10@gmail.com')
on conflict (email) do nothing;

delete from public.platform_admins as admins
using auth.users as users
where users.id = admins.user_id
  and lower(trim(coalesce(users.email, ''))) <> 'stevenoueiss10@gmail.com';

insert into public.platform_admins (user_id, note)
select
  users.id,
  'Granted automatically from the BeyBridge administrator email allowlist.'
from auth.users as users
where lower(trim(coalesce(users.email, ''))) = 'stevenoueiss10@gmail.com'
on conflict (user_id) do nothing;

delete from public.user_notifications as notifications
using auth.users as users
where users.id = notifications.user_id
  and lower(trim(coalesce(users.email, ''))) <> 'stevenoueiss10@gmail.com'
  and notifications.kind = 'verification_submitted'
  and notifications.route = '/admin';

-- Creating a first listing is the action that activates provider mode. A
-- customer can create a listing they own, and the database promotes their
-- profile only after that insert succeeds.
drop policy if exists "providers can create their own listings" on public.providers;

create policy "users can create their first owned listing"
on public.providers for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
  )
);

create or replace function private.activate_provider_after_listing_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is not null then
    update public.profiles
    set account_type = 'provider'
    where id = new.owner_id
      and account_type <> 'provider';
  end if;

  return new;
end;
$$;

revoke all on function private.activate_provider_after_listing_created()
from public, anon, authenticated, service_role;

drop trigger if exists providers_activate_owner_after_insert on public.providers;
create trigger providers_activate_owner_after_insert
after insert on public.providers
for each row execute function private.activate_provider_after_listing_created();

-- New accounts always begin as customers. Provider status is derived from the
-- successful listing workflow above, not from editable auth metadata.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, account_type)
  values (
    new.id,
    coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    coalesce(trim(new.phone), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user()
from public, anon, authenticated;

comment on function private.activate_provider_after_listing_created() is
  'Activates provider mode only after an owned service listing is created successfully.';
