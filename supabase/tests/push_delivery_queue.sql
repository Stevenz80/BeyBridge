begin;

create temporary table push_delivery_test_context (
  user_id uuid not null,
  notification_id uuid
) on commit drop;

insert into push_delivery_test_context (user_id)
values (gen_random_uuid());

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select
  user_id,
  concat('push-delivery-', user_id, '@example.com'),
  '{"full_name":"Push Delivery Test","account_type":"customer"}'::jsonb,
  now(),
  now()
from push_delivery_test_context;

insert into public.push_tokens (
  user_id,
  expo_push_token,
  platform,
  device_name,
  app_version
)
select
  user_id,
  'ExpoPushToken[push_delivery_test_device_123456789]',
  'android',
  'Push delivery test device',
  '1.0.0'
from push_delivery_test_context;

with inserted as (
  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  )
  select
    user_id,
    'request_status',
    'Push queue test',
    'This notification verifies server-only ticket and receipt processing.',
    '/notifications',
    'service_request',
    gen_random_uuid()::text,
    'push_queue_test'
  from push_delivery_test_context
  returning id
)
update push_delivery_test_context
set notification_id = (select id from inserted);

do $$
begin
  if (select count(*) from public.push_deliveries) <> 1 then
    raise exception 'An enabled registered device was not queued exactly once';
  end if;

  if has_table_privilege('authenticated', 'public.push_deliveries', 'select') then
    raise exception 'Authenticated users must not have direct push-delivery access';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_push_deliveries(integer)',
    'execute'
  ) then
    raise exception 'Authenticated users must not be able to claim push deliveries';
  end if;
end;
$$;

set local role service_role;

create temporary table claimed_push_delivery on commit drop as
select * from public.claim_push_deliveries(100);

do $$
begin
  if (select count(*) from claimed_push_delivery) <> 1 then
    raise exception 'The service worker did not claim the queued delivery';
  end if;

  if (select attempt_number from claimed_push_delivery) <> 1 then
    raise exception 'The delivery attempt counter was not incremented';
  end if;

  if (select count(*) from public.push_deliveries where state = 'sending') <> 1 then
    raise exception 'The claimed delivery did not enter the sending state';
  end if;
end;
$$;

reset role;
rollback;
