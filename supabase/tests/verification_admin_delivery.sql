begin;

create temporary table verification_admin_delivery_test_context (
  admin_id uuid not null,
  admin_email text not null,
  provider_id text not null,
  provider_owner_id uuid not null,
  verification_request_id uuid
) on commit drop;

with ids as (
  select
    gen_random_uuid() as admin_id,
    gen_random_uuid() as provider_owner_id,
    gen_random_uuid() as provider_uuid
)
insert into verification_admin_delivery_test_context (
  admin_id,
  admin_email,
  provider_id,
  provider_owner_id
)
select
  admin_id,
  'verification-admin-' || admin_id::text || '@example.com',
  'verification-delivery-' || provider_uuid::text,
  provider_owner_id
from ids;

insert into private.platform_admin_email_allowlist (email)
select admin_email
from verification_admin_delivery_test_context;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select
  admin_id,
  admin_email,
  '{"full_name":"BeyBridge Admin","account_type":"customer"}'::jsonb,
  now(),
  now()
from verification_admin_delivery_test_context
union all
select
  provider_owner_id,
  'verification-provider-' || provider_owner_id::text || '@example.com',
  '{"full_name":"Verification Provider","account_type":"provider"}'::jsonb,
  now(),
  now()
from verification_admin_delivery_test_context;

do $$
begin
  if not exists (
    select 1
    from public.platform_admins
    where user_id = (select admin_id from verification_admin_delivery_test_context)
  ) then
    raise exception 'The administrator email allowlist did not assign the platform role';
  end if;
end;
$$;

insert into public.providers (
  id,
  owner_id,
  category_id,
  name,
  description,
  area,
  phone,
  listing_status
)
select
  provider_id,
  provider_owner_id,
  1,
  'Verification Delivery Test',
  'A rollback-safe listing used to verify administrator delivery behavior.',
  'Beirut',
  '+961 01 000 000',
  'draft'
from verification_admin_delivery_test_context;

grant select, update on table verification_admin_delivery_test_context to authenticated;
grant select on table verification_admin_delivery_test_context to service_role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from verification_admin_delivery_test_context),
  true
);

with inserted as (
  insert into public.provider_verification_requests (
    provider_id,
    business_registration,
    license_number,
    evidence_summary
  )
  select
    provider_id,
    'Admin Delivery Registration 001',
    'Admin Delivery Licence 001',
    'This evidence summary verifies the administrator notification and server email outbox workflow.'
  from verification_admin_delivery_test_context
  returning id
)
update verification_admin_delivery_test_context
set verification_request_id = (select id from inserted);

reset role;

update public.verification_admin_email_deliveries
set available_at = '2000-01-01 00:00:00+00'
where verification_request_id = (
  select verification_request_id from verification_admin_delivery_test_context
);

do $$
begin
  if not exists (
    select 1
    from public.verification_admin_email_deliveries
    where verification_request_id = (
      select verification_request_id from verification_admin_delivery_test_context
    )
  ) then
    raise exception 'The verification request was not queued for administrator email delivery';
  end if;

  if not exists (
    select 1
    from public.user_notifications
    where user_id = (select admin_id from verification_admin_delivery_test_context)
      and kind = 'verification_submitted'
      and route = '/admin'
  ) then
    raise exception 'The administrator did not receive an in-app verification notification';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.verification_admin_email_deliveries',
    'select'
  ) then
    raise exception 'Authenticated users must not read the verification email outbox';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_verification_admin_emails(integer)',
    'execute'
  ) then
    raise exception 'Authenticated users must not claim verification emails';
  end if;
end;
$$;

set local role service_role;

create temporary table claimed_verification_email on commit drop as
select * from public.claim_verification_admin_emails(100);

do $$
begin
  if not exists (
    select 1
    from claimed_verification_email
    where verification_request_id = (
      select verification_request_id from verification_admin_delivery_test_context
    )
  ) then
    raise exception 'The server worker did not claim the verification email';
  end if;

  if (
    select owner_email
    from claimed_verification_email
    where verification_request_id = (
      select verification_request_id from verification_admin_delivery_test_context
    )
  ) = '' then
    raise exception 'The claimed verification email did not include the provider account email';
  end if;

  if (
    select attempt_number
    from claimed_verification_email
    where verification_request_id = (
      select verification_request_id from verification_admin_delivery_test_context
    )
  ) <> 1 then
    raise exception 'The verification email attempt counter was not incremented';
  end if;
end;
$$;

reset role;
rollback;
