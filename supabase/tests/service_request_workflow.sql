begin;

create temporary table test_context (
  customer_id uuid not null,
  attacker_id uuid not null,
  provider_id text not null,
  provider_owner_id uuid not null
) on commit drop;

insert into test_context (customer_id, attacker_id, provider_id, provider_owner_id)
select
  gen_random_uuid(),
  gen_random_uuid(),
  providers.id,
  providers.owner_id
from public.providers
where providers.owner_id is not null
  and providers.listing_status = 'published'
order by providers.created_at
limit 1;

do $$
begin
  if not exists (select 1 from test_context) then
    raise exception 'The request workflow test needs one published provider-owned listing';
  end if;
end;
$$;

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  customer_id,
  concat('request-customer-', customer_id, '@example.com'),
  '{"full_name":"Request Test Customer","account_type":"customer"}'::jsonb,
  now(),
  now()
from test_context
union all
select
  attacker_id,
  concat('request-attacker-', attacker_id, '@example.com'),
  '{"full_name":"Request Test Attacker","account_type":"customer"}'::jsonb,
  now(),
  now()
from test_context;

update public.profiles
set phone = '+96170000000', default_area = 'Beirut'
where id in (select customer_id from test_context);

grant select on table test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from test_context),
  true
);

insert into public.service_requests (
  provider_id,
  description,
  service_address,
  service_latitude,
  service_longitude,
  preferred_schedule,
  urgency,
  budget_amount,
  budget_currency
)
select
  provider_id,
  'The kitchen sink is leaking below the cabinet and needs inspection.',
  'Hamra, Beirut',
  33.8959,
  35.4821,
  'Friday after 3 PM',
  'urgent',
  100,
  'USD'
from test_context;

do $$
begin
  if (select count(*) from public.service_requests) <> 1 then
    raise exception 'Customer RLS did not return exactly one request';
  end if;

  if exists (
    select 1
    from public.service_requests
    where service_latitude <> 33.8959 or service_longitude <> 35.4821
  ) then
    raise exception 'Exact service coordinates were not retained';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from test_context),
  true
);

do $$
declare
  affected_rows integer;
begin
  if (select count(*) from public.service_requests) <> 0 then
    raise exception 'A non-participant could read the request';
  end if;

  update public.service_requests
  set status = 'cancelled';
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'A non-participant could update the request';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from test_context),
  true
);

update public.service_requests
set
  status = 'quoted',
  quoted_price = 125,
  provider_message = 'I can inspect this Friday and have included the likely repair cost.';

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from test_context),
  true
);

update public.service_requests
set status = 'accepted';

select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from test_context),
  true
);

update public.service_requests set status = 'scheduled';
update public.service_requests set status = 'in_progress';
update public.service_requests set status = 'completed';

do $$
begin
  if (select status from public.service_requests) <> 'completed' then
    raise exception 'The service request did not reach completed status';
  end if;

  if (select count(*) from public.service_request_events) <> 6 then
    raise exception 'The service request audit timeline is incomplete';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from test_context),
  true
);

update public.service_requests
set review_prompted_at = now();

insert into public.reviews (provider_id, author_name, rating, comment)
select
  provider_id,
  'Ignored client-supplied name',
  5,
  'The provider arrived on time, explained the work, and completed it carefully.'
from test_context;

do $$
begin
  if (select count(*) from public.service_request_events) <> 6 then
    raise exception 'Acknowledging the review prompt created a false status event';
  end if;

  if (select review_prompted_at from public.service_requests) is null then
    raise exception 'The one-time review prompt was not acknowledged';
  end if;

  if not exists (
    select 1
    from public.reviews
    where user_id = (select customer_id from test_context)
      and provider_id = (select provider_id from test_context)
  ) then
    raise exception 'A customer with a completed service could not leave a review';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from test_context),
  true
);

do $$
begin
  begin
    insert into public.reviews (provider_id, author_name, rating, comment)
    select
      provider_id,
      'Unverified reviewer',
      1,
      'This account never completed a service and must not be allowed to review.'
    from test_context;

    raise exception 'A customer without a completed service could leave a review';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
