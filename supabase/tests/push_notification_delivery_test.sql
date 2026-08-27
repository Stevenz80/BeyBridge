begin;

create temporary table push_test_context (
  user_id uuid not null,
  notification_id uuid
) on commit drop;

insert into push_test_context (user_id)
values (gen_random_uuid());

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select
  user_id,
  concat('push-test-', user_id, '@example.com'),
  '{"full_name":"Push Test User","account_type":"customer"}'::jsonb,
  now(),
  now()
from push_test_context;

grant select, update on table push_test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from push_test_context),
  true
);

select public.register_push_token(
  'ExpoPushToken[push_notification_delivery_test_123456789]',
  'android',
  'Push test device',
  '1.0.0'
);

update push_test_context
set notification_id = public.send_test_push_notification();

do $$
declare
  health record;
begin
  select * into health from public.get_my_push_delivery_health();

  if health.enabled_device_count <> 1 then
    raise exception 'Push health did not report the registered test device';
  end if;

  if health.latest_state <> 'pending' then
    raise exception 'The test notification was not queued for delivery';
  end if;

  if not exists (
    select 1
    from public.user_notifications
    where id = (select notification_id from push_test_context)
      and kind = 'push_test'
      and source_type = 'system'
  ) then
    raise exception 'The authenticated push test notification was not created';
  end if;

  begin
    perform public.send_test_push_notification();
    raise exception 'The push test rate limit was not enforced';
  exception
    when others then
      if sqlerrm = 'The push test rate limit was not enforced' then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('authenticated', 'public.push_deliveries', 'select') then
    raise exception 'Push diagnostics must not expose the delivery outbox directly';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_push_delivery_health()',
    'execute'
  ) then
    raise exception 'Authenticated users cannot inspect their safe push health summary';
  end if;
end;
$$;

rollback;
