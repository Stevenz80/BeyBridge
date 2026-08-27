begin;

create temporary table provider_activation_test_context (
  user_id uuid not null
) on commit drop;

insert into provider_activation_test_context (user_id)
values (gen_random_uuid());

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  user_id,
  concat('provider-activation-', user_id, '@example.com'),
  '{"full_name":"Listing Activation Test","account_type":"provider"}'::jsonb,
  now(),
  now()
from provider_activation_test_context;

do $$
begin
  if (
    select profiles.account_type
    from public.profiles as profiles
    where profiles.id = (select user_id from provider_activation_test_context)
  ) <> 'customer' then
    raise exception 'A new account was promoted before creating a listing';
  end if;
end;
$$;

grant select on table provider_activation_test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from provider_activation_test_context),
  true
);

insert into public.providers (
  owner_id,
  category_id,
  name,
  description,
  address,
  area,
  phone,
  whatsapp,
  opening_hours,
  listing_status,
  service_mode,
  price_type,
  price_currency,
  emergency_service
)
select
  user_id,
  1,
  'Listing Activation Test',
  'A rollback-safe draft listing that verifies provider activation behavior.',
  'Beirut',
  'Beirut',
  '+96170000000',
  '96170000000',
  '{"mon":"9:00-18:00"}'::jsonb,
  'draft',
  'mobile',
  'quote',
  'USD',
  false
from provider_activation_test_context;

do $$
begin
  if (
    select profiles.account_type
    from public.profiles as profiles
    where profiles.id = (select user_id from provider_activation_test_context)
  ) <> 'provider' then
    raise exception 'Creating the first listing did not activate provider mode';
  end if;
end;
$$;

reset role;
rollback;
