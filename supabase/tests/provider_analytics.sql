begin;

create temporary table analytics_test_context (
  customer_id uuid not null,
  attacker_id uuid not null,
  provider_id text not null,
  provider_owner_id uuid not null
) on commit drop;

insert into analytics_test_context (customer_id, attacker_id, provider_id, provider_owner_id)
select
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
  if not exists (select 1 from analytics_test_context) then
    raise exception 'The analytics test needs one provider-owned listing';
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select
  customer_id,
  concat('analytics-customer-', customer_id, '@example.com'),
  '{"full_name":"Analytics Test Customer","account_type":"customer"}'::jsonb,
  now(),
  now()
from analytics_test_context
union all
select
  attacker_id,
  concat('analytics-attacker-', attacker_id, '@example.com'),
  '{"full_name":"Analytics Test Attacker","account_type":"customer"}'::jsonb,
  now(),
  now()
from analytics_test_context;

update public.profiles
set phone = '+96170000000', default_area = 'Beirut'
where id = (select customer_id from analytics_test_context);

update public.providers
set listing_status = 'published', moderation_status = 'active'
where id = (select provider_id from analytics_test_context);

grant select on table analytics_test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from analytics_test_context),
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
  'This request verifies the private provider performance analytics workflow.',
  'Achrafieh, Beirut',
  'Tomorrow morning',
  'standard',
  75,
  'USD'
from analytics_test_context;

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from analytics_test_context),
  true
);

update public.service_requests
set
  status = 'quoted',
  quoted_price = 75,
  provider_message = 'The analytics test quote is ready.'
where customer_id = (select customer_id from analytics_test_context);

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from analytics_test_context),
  true
);

update public.service_requests
set status = 'accepted'
where customer_id = (select customer_id from analytics_test_context);

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from analytics_test_context),
  true
);

update public.service_requests
set status = 'scheduled', scheduled_for = now() + interval '1 day'
where customer_id = (select customer_id from analytics_test_context);

update public.service_requests
set status = 'in_progress'
where customer_id = (select customer_id from analytics_test_context);

update public.service_requests
set status = 'completed'
where customer_id = (select customer_id from analytics_test_context);

do $$
declare
  analytics jsonb := public.get_provider_analytics(30);
begin
  if (analytics ->> 'window_days')::integer <> 30 then
    raise exception 'The analytics window was not preserved';
  end if;

  if (analytics ->> 'total_requests')::integer < 1
    or (analytics ->> 'completed_requests')::integer < 1 then
    raise exception 'Completed provider requests were not counted';
  end if;

  if (analytics ->> 'response_rate')::numeric <= 0
    or (analytics ->> 'average_response_minutes') is null then
    raise exception 'Provider response performance was not calculated';
  end if;

  if (analytics ->> 'quotes_sent')::integer < 1
    or (analytics ->> 'quotes_accepted')::integer < 1 then
    raise exception 'Quote performance was not calculated';
  end if;

  if (analytics ->> 'completed_value_usd')::numeric < 75 then
    raise exception 'Completed quoted value was not calculated';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(analytics -> 'listings') listing
    where listing ->> 'provider_id' = (select provider_id from analytics_test_context)
  ) then
    raise exception 'The provider listing breakdown is incomplete';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from analytics_test_context),
  true
);

do $$
declare
  analytics jsonb := public.get_provider_analytics(30);
begin
  if (analytics ->> 'total_requests')::integer <> 0
    or jsonb_array_length(analytics -> 'listings') <> 0 then
    raise exception 'Provider analytics leaked across accounts';
  end if;
end;
$$;

reset role;
rollback;
