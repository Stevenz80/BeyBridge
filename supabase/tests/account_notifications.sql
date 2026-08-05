begin;

create temporary table notification_test_context (
  customer_id uuid not null,
  attacker_id uuid not null,
  admin_id uuid not null,
  provider_id text not null,
  provider_owner_id uuid not null
) on commit drop;

insert into notification_test_context (
  customer_id,
  attacker_id,
  admin_id,
  provider_id,
  provider_owner_id
)
select
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  providers.id,
  providers.owner_id
from public.providers
where providers.owner_id is not null
order by providers.created_at
limit 1;

do $$
begin
  if not exists (select 1 from notification_test_context) then
    raise exception 'The notification test needs one provider-owned listing';
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select
  customer_id,
  concat('notification-customer-', customer_id, '@example.com'),
  '{"full_name":"Notification Test Customer","account_type":"customer"}'::jsonb,
  now(),
  now()
from notification_test_context
union all
select
  attacker_id,
  concat('notification-attacker-', attacker_id, '@example.com'),
  '{"full_name":"Notification Test Attacker","account_type":"customer"}'::jsonb,
  now(),
  now()
from notification_test_context
union all
select
  admin_id,
  concat('notification-admin-', admin_id, '@example.com'),
  '{"full_name":"Notification Test Admin","account_type":"customer"}'::jsonb,
  now(),
  now()
from notification_test_context;

insert into public.platform_admins (user_id, note)
select admin_id, 'Rollback-safe notification workflow test'
from notification_test_context;

update public.profiles
set phone = '+96170000000', default_area = 'Beirut'
where id = (select customer_id from notification_test_context);

update public.providers
set
  is_verified = false,
  listing_status = 'published',
  moderation_status = 'active',
  moderation_reason = '',
  moderated_at = null,
  moderated_by = null
where id = (select provider_id from notification_test_context);

grant select on table notification_test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from notification_test_context),
  true
);

insert into public.service_requests (
  provider_id,
  description,
  service_address,
  preferred_schedule,
  urgency,
  budget_amount,
  budget_currency
)
select
  provider_id,
  'The notification test needs a detailed service request for the provider.',
  'Hamra, Beirut',
  'Friday afternoon',
  'standard',
  80,
  'USD'
from notification_test_context;

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from notification_test_context),
  true
);

do $$
begin
  if (select count(*) from public.user_notifications where kind = 'request_created') <> 1 then
    raise exception 'The provider did not receive the new-request notification';
  end if;
end;
$$;

select public.register_push_token(
  'ExpoPushToken[notification_test_device_123456789]',
  'android',
  'Notification test device',
  '1.0.0'
);

insert into public.provider_verification_requests (
  provider_id,
  business_registration,
  license_number,
  evidence_summary
)
select
  provider_id,
  'Notification Registration 001',
  'Notification Licence 001',
  'The provider supplied complete evidence for the notification workflow test.'
from notification_test_context;

update public.service_requests
set
  status = 'quoted',
  quoted_price = 95,
  provider_message = 'A quote is ready for the notification workflow test.';

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from notification_test_context),
  true
);

insert into public.reports (
  target_type,
  provider_id,
  review_id,
  reason,
  details
)
select
  'provider',
  provider_id,
  null,
  'misleading',
  'This report exists to verify account notification delivery and access control.'
from notification_test_context;

do $$
begin
  if (select count(*) from public.user_notifications where kind = 'request_status') <> 1 then
    raise exception 'The customer did not receive the request-status notification';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from notification_test_context),
  true
);

do $$
begin
  if (select count(*) from public.user_notifications) <> 0 then
    raise exception 'A different user could read private notifications';
  end if;

  if (select count(*) from public.push_tokens) <> 0 then
    raise exception 'A different user could read private push registrations';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select admin_id::text from notification_test_context),
  true
);

update public.provider_verification_requests
set status = 'approved', admin_note = 'The evidence was accepted in the notification test.'
where status = 'pending';

update public.reports
set status = 'reviewing', admin_note = 'The report is under active review.'
where status = 'open';

insert into public.provider_moderation_actions (provider_id, action, reason)
select provider_id, 'suspend', 'The listing is paused for the notification workflow test.'
from notification_test_context;

update public.reports
set status = 'resolved', admin_note = 'The notification workflow test report was resolved.'
where status = 'reviewing';

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from notification_test_context),
  true
);

do $$
begin
  if (select count(*) from public.user_notifications where kind = 'verification_status') <> 1 then
    raise exception 'The provider did not receive the verification decision';
  end if;

  if (select count(*) from public.user_notifications where kind = 'provider_moderation') <> 1 then
    raise exception 'The provider did not receive the moderation notification';
  end if;

  if (select count(*) from public.push_tokens) <> 1 then
    raise exception 'The provider could not read the registered device token';
  end if;
end;
$$;

update public.user_notifications
set read_at = now()
where read_at is null;

do $$
begin
  if exists (select 1 from public.user_notifications where read_at is null) then
    raise exception 'The provider could not mark notifications as read';
  end if;
end;
$$;

select public.unregister_push_token('ExpoPushToken[notification_test_device_123456789]');

do $$
begin
  if (select count(*) from public.push_tokens) <> 0 then
    raise exception 'The provider device token was not removed';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from notification_test_context),
  true
);

do $$
begin
  if (select count(*) from public.user_notifications where kind = 'report_status') <> 2 then
    raise exception 'The customer did not receive both report status notifications';
  end if;
end;
$$;

reset role;
rollback;
