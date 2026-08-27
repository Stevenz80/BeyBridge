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
    case
      when new.raw_user_meta_data ->> 'account_type' = 'provider' then 'provider'
      else 'customer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

update public.profiles as profiles
set phone = trim(users.phone)
from auth.users as users
where users.id = profiles.id
  and coalesce(trim(profiles.phone), '') = ''
  and coalesce(trim(users.phone), '') <> '';

comment on function private.handle_new_user() is
  'Creates BeyBridge profiles for email, phone OTP, and social-auth users while preserving trusted account defaults.';
