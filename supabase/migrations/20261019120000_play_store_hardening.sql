-- Server-side fixes from the Play Store readiness audit (19 October 2026).

-- 1. New profiles keep the language chosen at sign-up. The app sends
--    preferred_language in the sign-up metadata; anything else stays 'en' so a
--    bad value can never violate the column's check constraint and block sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, account_type, preferred_language)
  values (
    new.id,
    coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    coalesce(trim(new.phone), ''),
    'customer',
    case when new.raw_user_meta_data ->> 'preferred_language' in ('en', 'ar')
      then new.raw_user_meta_data ->> 'preferred_language' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- 2. The verified badge describes the business an administrator reviewed. If the
--    owner changes who or what the listing is, the badge is withdrawn until a new
--    review. Administrator decisions run as the definer role and are unaffected.
create or replace function private.reset_verification_on_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_verified
    and (current_user in ('anon', 'authenticated') or (select auth.role()) in ('anon', 'authenticated'))
    and (new.name is distinct from old.name
      or new.category_id is distinct from old.category_id
      or new.phone is distinct from old.phone
      or new.whatsapp is distinct from old.whatsapp
      or new.address is distinct from old.address) then
    new.is_verified := false;
  end if;
  return new;
end;
$$;

revoke all on function private.reset_verification_on_identity_change() from public, anon, authenticated;

drop trigger if exists providers_reset_verification on public.providers;
create trigger providers_reset_verification
before update on public.providers
for each row execute function private.reset_verification_on_identity_change();

-- 3. Limit service requests so one customer cannot flood a provider with requests
--    and push notifications. Cancelled requests count, so cancel-and-resend cannot
--    bypass the cap. The existing (customer_id, created_at desc) index serves these counts.

create or replace function private.limit_service_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    return new;
  end if;

  if (select count(*) from public.service_requests
      where customer_id = current_user_id
        and provider_id = new.provider_id
        and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'You have sent this provider several requests today. Wait for a reply or try again tomorrow.'
      using errcode = 'P0001';
  end if;

  if (select count(*) from public.service_requests
      where customer_id = current_user_id
        and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You have sent many requests in the last hour. Please try again later.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.limit_service_requests() from public, anon, authenticated;

drop trigger if exists service_requests_limit_rate on public.service_requests;
create trigger service_requests_limit_rate
before insert on public.service_requests
for each row execute function private.limit_service_requests();

-- 4. A device's push token belongs to whoever registered it last. Under SECURITY
--    INVOKER the conflict update could not move a row owned by a previous account
--    (RLS), so that account kept receiving this device's notifications when its
--    session ended without an explicit sign-out.
create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default '',
  p_app_version text default ''
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_token text := trim(p_expo_push_token);
  registered_token public.push_tokens;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to register notifications';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'Push notifications are only available on Android and iOS';
  end if;

  if char_length(clean_token) not between 20 and 512
    or clean_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform, device_name, app_version, enabled)
  values (
    current_user_id,
    clean_token,
    p_platform,
    left(coalesce(trim(p_device_name), ''), 120),
    left(coalesce(trim(p_app_version), ''), 50),
    true
  )
  on conflict (expo_push_token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true
  returning * into registered_token;

  return registered_token;
end;
$$;

revoke all on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;
