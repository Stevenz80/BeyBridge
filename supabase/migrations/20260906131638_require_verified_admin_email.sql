-- An allowlisted address alone does not prove ownership of that address.
create or replace function private.sync_platform_admin_from_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  automatic_note constant text := 'Granted automatically from the BeyBridge administrator email allowlist.';
begin
  if new.email_confirmed_at is not null and exists (
    select 1 from private.platform_admin_email_allowlist as allowed
    where allowed.email = lower(trim(coalesce(new.email, '')))
  ) then
    insert into public.platform_admins (user_id, note)
    values (new.id, automatic_note)
    on conflict (user_id) do nothing;
  else
    -- Do not remove a role deliberately granted by a separate administrative process.
    delete from public.platform_admins
    where user_id = new.id and note = automatic_note;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_platform_admin_from_email()
from public, anon, authenticated, service_role;

drop trigger if exists auth_users_sync_platform_admin on auth.users;
create trigger auth_users_sync_platform_admin
after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.sync_platform_admin_from_email();

-- Repair previously generated grants, including accounts awaiting confirmation.
delete from public.platform_admins as admins
using auth.users as users
where admins.user_id = users.id
  and admins.note = 'Granted automatically from the BeyBridge administrator email allowlist.'
  and (users.email_confirmed_at is null or not exists (
    select 1 from private.platform_admin_email_allowlist as allowed
    where allowed.email = lower(trim(coalesce(users.email, '')))
  ));

insert into public.platform_admins (user_id, note)
select users.id, 'Granted automatically from the BeyBridge administrator email allowlist.'
from auth.users as users
join private.platform_admin_email_allowlist as allowed
  on allowed.email = lower(trim(coalesce(users.email, '')))
where users.email_confirmed_at is not null
on conflict (user_id) do nothing;
