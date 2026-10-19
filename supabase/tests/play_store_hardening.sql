-- Regression checks for 20261019120000_play_store_hardening.sql.
-- Run against an isolated database: psql -v ON_ERROR_STOP=1 -f supabase/tests/play_store_hardening.sql
begin;

create temporary table hardening_test_context (
  customer_id uuid not null,
  provider_owner_id uuid not null,
  other_user_id uuid not null,
  listing_id text
) on commit drop;

insert into hardening_test_context (customer_id, provider_owner_id, other_user_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

-- 1. Sign-up language reaches the new profile; invalid values fall back to English.
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select customer_id, concat('hardening-customer-', customer_id, '@example.com'),
  '{"full_name":"Arabic Customer","preferred_language":"ar"}'::jsonb, now(), now()
from hardening_test_context;
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select provider_owner_id, concat('hardening-provider-', provider_owner_id, '@example.com'),
  '{"full_name":"Hardening Provider","preferred_language":"fr"}'::jsonb, now(), now()
from hardening_test_context;
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select other_user_id, concat('hardening-other-', other_user_id, '@example.com'),
  '{"full_name":"Other Device User"}'::jsonb, now(), now()
from hardening_test_context;

do $$
begin
  if (select preferred_language from public.profiles where id = (select customer_id from hardening_test_context)) <> 'ar' then
    raise exception 'The sign-up language was not stored on the new profile';
  end if;
  if (select preferred_language from public.profiles where id = (select provider_owner_id from hardening_test_context)) <> 'en' then
    raise exception 'An unsupported sign-up language did not fall back to English';
  end if;
end;
$$;

-- 2. A verified listing loses the badge when its owner changes identity fields.
insert into public.providers (owner_id, category_id, name, address, area, phone, whatsapp, opening_hours,
  listing_status, service_mode, price_type, price_currency, emergency_service, is_verified)
select provider_owner_id, 2, 'Hardening Electric', 'Main Street', 'Beirut', '+96170000001', '',
  '{}'::jsonb, 'published', 'on_site', 'quote', 'USD', false, true
from hardening_test_context;
update hardening_test_context
set listing_id = (select id from public.providers where name = 'Hardening Electric' limit 1);

grant select on table hardening_test_context to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select provider_owner_id::text from hardening_test_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.providers set description = 'Updated description'
where id = (select listing_id from hardening_test_context);
do $$
begin
  if not (select is_verified from public.providers where id = (select listing_id from hardening_test_context)) then
    raise exception 'Editing a non-identity field withdrew the verified badge';
  end if;
end;
$$;

update public.providers set name = 'Renamed Business'
where id = (select listing_id from hardening_test_context);
do $$
begin
  if (select is_verified from public.providers where id = (select listing_id from hardening_test_context)) then
    raise exception 'Renaming a verified listing kept the verified badge';
  end if;
end;
$$;

-- 3. A customer cannot send more than three requests to one provider in a day.
select set_config('request.jwt.claim.sub', (select customer_id::text from hardening_test_context), true);
insert into public.service_requests (provider_id, description, service_address, urgency, budget_currency)
select listing_id, concat('Request number ', n, ' for the hardening test'), 'Hamra', 'standard', 'USD'
from hardening_test_context, generate_series(1, 3) as n;

do $$
begin
  begin
    insert into public.service_requests (provider_id, description, service_address, urgency, budget_currency)
    select listing_id, 'A fourth request that must be rejected', 'Hamra', 'standard', 'USD'
    from hardening_test_context;
    raise exception 'A fourth request to the same provider within 24 hours was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'You have sent this provider several requests today%' then raise; end if;
  end;
end;
$$;

-- 4. A device token moves to the account that registered it last.
select set_config('request.jwt.claim.sub', (select customer_id::text from hardening_test_context), true);
select public.register_push_token('ExponentPushToken[hardening-test-device-token]', 'android', '', '1.0.0');
select set_config('request.jwt.claim.sub', (select other_user_id::text from hardening_test_context), true);
select public.register_push_token('ExponentPushToken[hardening-test-device-token]', 'android', '', '1.0.0');

reset role;
do $$
begin
  if (select user_id from public.push_tokens where expo_push_token = 'ExponentPushToken[hardening-test-device-token]')
    <> (select other_user_id from hardening_test_context) then
    raise exception 'A re-registered device token stayed bound to the previous account';
  end if;
end;
$$;

rollback;
