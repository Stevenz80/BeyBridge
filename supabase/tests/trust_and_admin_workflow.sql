begin;

create temporary table trust_test_context (
  customer_id uuid not null,
  attacker_id uuid not null,
  admin_id uuid not null,
  provider_id text not null,
  provider_owner_id uuid not null
) on commit drop;

insert into trust_test_context (customer_id, attacker_id, admin_id, provider_id, provider_owner_id)
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
  if not exists (select 1 from trust_test_context) then
    raise exception 'The trust workflow test needs one provider-owned listing';
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
  concat('trust-customer-', customer_id, '@example.com'),
  '{"full_name":"Trust Test Customer","account_type":"customer"}'::jsonb,
  now(),
  now()
from trust_test_context
union all
select
  attacker_id,
  concat('trust-attacker-', attacker_id, '@example.com'),
  '{"full_name":"Trust Test Attacker","account_type":"customer"}'::jsonb,
  now(),
  now()
from trust_test_context
union all
select
  admin_id,
  concat('trust-admin-', admin_id, '@example.com'),
  '{"full_name":"Trust Test Admin","account_type":"customer"}'::jsonb,
  now(),
  now()
from trust_test_context;

insert into public.platform_admins (user_id, note)
select admin_id, 'Rollback-safe trust workflow test'
from trust_test_context;

update public.providers
set
  is_verified = false,
  listing_status = 'published',
  moderation_status = 'active',
  moderation_reason = '',
  moderated_at = null,
  moderated_by = null
where id = (select provider_id from trust_test_context);

grant select on table trust_test_context to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  (select provider_owner_id::text from trust_test_context),
  true
);

insert into public.provider_verification_requests (
  provider_id,
  business_registration,
  license_number,
  evidence_summary
)
select
  provider_id,
  'Trust Workflow Registration 001',
  'Trust Workflow Licence 001',
  'The provider supplied a registration reference and professional licence for administrator review.'
from trust_test_context;

do $$
begin
  if (select count(*) from public.provider_verification_requests) <> 1 then
    raise exception 'The provider could not read their verification request';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select customer_id::text from trust_test_context),
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
  'The public listing contains information that should be checked by an administrator.'
from trust_test_context;

do $$
begin
  if (select count(*) from public.reports) <> 1 then
    raise exception 'The reporter could not read their own report';
  end if;

  if not exists (
    select 1 from public.reports where char_length(target_snapshot) > 20
  ) then
    raise exception 'The report did not preserve a useful content snapshot';
  end if;

  if (select count(*) from public.provider_verification_requests) <> 0 then
    raise exception 'A customer could read a provider verification request';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from trust_test_context),
  true
);

do $$
begin
  if (select count(*) from public.reports) <> 0 then
    raise exception 'A non-reporter could read another user report';
  end if;

  if (select count(*) from public.provider_verification_requests) <> 0 then
    raise exception 'A non-owner could read provider verification evidence';
  end if;

  begin
    insert into public.provider_moderation_actions (provider_id, action, reason)
    select provider_id, 'suspend', 'An attacker must not be able to suspend this listing.'
    from trust_test_context;
    raise exception 'A non-administrator inserted a moderation action';
  exception
    when others then
      if sqlerrm <> 'Administrator access is required to moderate providers' then
        raise;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select admin_id::text from trust_test_context),
  true
);

do $$
begin
  if (select count(*) from public.provider_verification_requests) <> 1 then
    raise exception 'The administrator could not read the verification queue';
  end if;

  if (select count(*) from public.reports) <> 1 then
    raise exception 'The administrator could not read the report queue';
  end if;
end;
$$;

update public.provider_verification_requests
set status = 'approved', admin_note = 'Registration and professional licence references were checked.'
where status = 'pending';

do $$
begin
  if not (
    select is_verified
    from public.providers
    where id = (select provider_id from trust_test_context)
  ) then
    raise exception 'Approving verification did not set the provider badge';
  end if;
end;
$$;

update public.reports
set status = 'reviewing', admin_note = 'Administrator started reviewing the listing details.'
where status = 'open';

insert into public.provider_moderation_actions (provider_id, action, reason)
select provider_id, 'suspend', 'The listing is paused while the reported claims are investigated.'
from trust_test_context;

do $$
begin
  if not exists (
    select 1
    from public.providers
    where id = (select provider_id from trust_test_context)
      and moderation_status = 'suspended'
      and listing_status = 'paused'
  ) then
    raise exception 'Suspension did not pause and restrict the provider listing';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select attacker_id::text from trust_test_context),
  true
);

do $$
begin
  if exists (
    select 1 from public.providers where id = (select provider_id from trust_test_context)
  ) then
    raise exception 'A suspended provider remained visible to a public customer';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select admin_id::text from trust_test_context),
  true
);

insert into public.provider_moderation_actions (provider_id, action, reason)
select provider_id, 'restore', 'The administrator completed the review and lifted the restriction.'
from trust_test_context;

update public.reports
set status = 'resolved', admin_note = 'The report was investigated and the moderation outcome was recorded.'
where status = 'reviewing';

do $$
begin
  if not exists (
    select 1
    from public.providers
    where id = (select provider_id from trust_test_context)
      and moderation_status = 'active'
      and listing_status = 'paused'
  ) then
    raise exception 'Restoring moderation should lift the restriction without silently republishing';
  end if;

  if not exists (
    select 1
    from public.reports
    where status = 'resolved'
      and reviewed_by = (select admin_id from trust_test_context)
      and resolved_at is not null
  ) then
    raise exception 'The report resolution audit fields were not recorded';
  end if;

  if (select count(*) from public.provider_moderation_actions) <> 2 then
    raise exception 'The moderation audit trail should contain suspend and restore actions';
  end if;
end;
$$;

reset role;
rollback;
