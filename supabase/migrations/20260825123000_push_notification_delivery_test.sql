alter table public.user_notifications
  drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications
  add constraint user_notifications_kind_check check (kind in (
    'request_created',
    'request_status',
    'verification_submitted',
    'verification_status',
    'report_status',
    'provider_moderation',
    'push_test'
  ));

alter table public.user_notifications
  drop constraint if exists user_notifications_source_type_check;

alter table public.user_notifications
  add constraint user_notifications_source_type_check check (source_type in (
    'service_request',
    'verification_request',
    'report',
    'provider',
    'system'
  ));

create function public.send_test_push_notification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_notification_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to test push notifications';
  end if;

  if not exists (
    select 1
    from public.push_tokens as tokens
    where tokens.user_id = current_user_id
      and tokens.enabled
  ) then
    raise exception 'Enable notifications on this device before sending a test alert';
  end if;

  if exists (
    select 1
    from public.user_notifications as notifications
    where notifications.user_id = current_user_id
      and notifications.kind = 'push_test'
      and notifications.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Please wait 30 seconds before sending another test alert';
  end if;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    current_user_id,
    'push_test',
    'BeyBridge notifications are working',
    'This test confirms that account alerts can reach this device.',
    '/notifications',
    'system',
    current_user_id::text,
    'push-test:' || gen_random_uuid()::text
  )
  returning id into created_notification_id;

  return created_notification_id;
end;
$$;

create function public.get_my_push_delivery_health()
returns table (
  enabled_device_count integer,
  latest_state text,
  latest_error_code text,
  latest_status_message text,
  latest_updated_at timestamptz,
  latest_notification_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to inspect push delivery';
  end if;

  return query
  select
    (
      select count(*)::integer
      from public.push_tokens as tokens
      where tokens.user_id = current_user_id
        and tokens.enabled
    ),
    latest.state,
    coalesce(latest.error_code, ''),
    case
      when latest.state is null then ''
      when latest.state = 'pending' then 'Waiting for the delivery worker.'
      when latest.state = 'sending' then 'Sending to the Expo Push Service.'
      when latest.state = 'ticketed' then 'Expo accepted the alert for delivery.'
      when latest.state = 'delivered' then 'The device push provider accepted the alert.'
      when latest.state = 'cancelled' then 'This device registration is no longer active.'
      when latest.error_code = 'DeviceNotRegistered' then 'This app install needs to register for notifications again.'
      when latest.error_code in ('InvalidCredentials', 'MismatchSenderId') then 'The Android push sender credential needs attention.'
      when latest.error_code = 'ExpoServiceUnavailable' then 'The push service is temporarily unavailable and will retry.'
      when latest.error_code = 'ReceiptUnavailable' then 'The delivery provider did not return a final receipt.'
      else 'The latest alert could not be delivered. Re-enable notifications and try again.'
    end,
    latest.updated_at,
    latest.notification_created_at
  from (values (true)) as seed(always_one)
  left join lateral (
    select
      deliveries.state,
      deliveries.error_code,
      deliveries.updated_at,
      notifications.created_at as notification_created_at
    from public.push_deliveries as deliveries
    join public.user_notifications as notifications
      on notifications.id = deliveries.notification_id
    where notifications.user_id = current_user_id
    order by deliveries.created_at desc
    limit 1
  ) as latest on true;
end;
$$;

revoke all on function public.send_test_push_notification()
from public, anon, authenticated, service_role;
grant execute on function public.send_test_push_notification() to authenticated;

revoke all on function public.get_my_push_delivery_health()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_push_delivery_health() to authenticated;

comment on function public.send_test_push_notification() is
  'Queues a rate-limited end-to-end push test for the current authenticated user.';

comment on function public.get_my_push_delivery_health() is
  'Returns safe delivery diagnostics for the current user without exposing device tokens.';
