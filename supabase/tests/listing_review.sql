-- Regression checks for 20261019130000_listing_review.sql.
begin;

create temporary table review_test_context (
  owner_id uuid not null,
  customer_id uuid not null,
  admin_id uuid not null,
  listing_id text
) on commit drop;
insert into review_test_context (owner_id, customer_id, admin_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select owner_id, concat('review-owner-', owner_id, '@example.com'), '{"full_name":"Review Owner"}'::jsonb, now(), now()
from review_test_context
union all
select customer_id, concat('review-customer-', customer_id, '@example.com'), '{"full_name":"Review Customer"}'::jsonb, now(), now()
from review_test_context
union all
select admin_id, concat('review-admin-', admin_id, '@example.com'), '{"full_name":"Review Admin"}'::jsonb, now(), now()
from review_test_context;
insert into public.platform_admins (user_id, note)
select admin_id, 'Rollback-safe listing review test' from review_test_context;

grant select, update on table review_test_context to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- The owner's new listing waits for review.
select set_config('request.jwt.claim.sub', (select owner_id::text from review_test_context), true);
insert into public.providers (owner_id, category_id, name, description, address, area, phone, whatsapp,
  opening_hours, listing_status, service_mode, price_type, price_currency, emergency_service)
select owner_id, 2, 'Review Test Electric', 'A listing created to check the administrator review step.',
  'Test Street', 'Beirut', '+96170000003', '', '{"mon":"9:00-18:00"}'::jsonb, 'published', 'on_site', 'quote', 'USD', false
from review_test_context;
update review_test_context set listing_id = (select id from public.providers where name = 'Review Test Electric');

do $$
begin
  if (select review_status from public.providers where id = (select listing_id from review_test_context)) <> 'pending' then
    raise exception 'A new owner listing was not left waiting for review';
  end if;
end;
$$;

-- Customers can neither see nor request it.
select set_config('request.jwt.claim.sub', (select customer_id::text from review_test_context), true);
do $$
begin
  if exists (select 1 from public.providers where id = (select listing_id from review_test_context)) then
    raise exception 'A customer could see a listing waiting for review';
  end if;
  begin
    insert into public.service_requests (provider_id, description, service_address, urgency, budget_currency)
    select listing_id, 'A request to a listing that is still under review.', 'Hamra', 'standard', 'USD'
    from review_test_context;
    raise exception 'A customer could request a listing waiting for review';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm = 'A customer could request a listing waiting for review' then raise; end if;
  end;
end;
$$;

-- A customer cannot approve; an administrator must explain a rejection.
do $$
begin
  begin
    perform public.review_provider_listing((select listing_id from review_test_context), 'approved', '');
    raise exception 'A customer approved a listing';
  exception when raise_exception then
    if sqlerrm <> 'Administrator access required' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', (select admin_id::text from review_test_context), true);
do $$
begin
  begin
    perform public.review_provider_listing((select listing_id from review_test_context), 'rejected', 'no');
    raise exception 'A rejection without a useful note was accepted';
  exception when raise_exception then
    if sqlerrm not like 'Explain what the provider must change%' then raise; end if;
  end;
end;
$$;
select public.review_provider_listing((select listing_id from review_test_context), 'approved', '');

do $$
begin
  if (select review_status from public.providers where id = (select listing_id from review_test_context)) <> 'approved' then
    raise exception 'Administrator approval did not stick';
  end if;
end;
$$;

-- Now public; the owner was notified.
select set_config('request.jwt.claim.sub', (select customer_id::text from review_test_context), true);
do $$
begin
  if not exists (select 1 from public.providers where id = (select listing_id from review_test_context)) then
    raise exception 'An approved listing was not visible to customers';
  end if;
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.user_notifications
    where user_id = (select owner_id from review_test_context) and source_id = (select listing_id from review_test_context)
      and title = 'Your listing is live'
  ) then
    raise exception 'The owner was not notified of the approval';
  end if;
end;
$$;

-- Editing hours keeps the approval; changing the name sends it back to review.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select owner_id::text from review_test_context), true);
update public.providers set opening_hours = '{"tue":"9:00-17:00"}'::jsonb
where id = (select listing_id from review_test_context);
do $$
begin
  if (select review_status from public.providers where id = (select listing_id from review_test_context)) <> 'approved' then
    raise exception 'Editing opening hours sent the listing back to review';
  end if;
end;
$$;
update public.providers set name = 'Review Test Electric Renamed'
where id = (select listing_id from review_test_context);
do $$
begin
  if (select review_status from public.providers where id = (select listing_id from review_test_context)) <> 'pending' then
    raise exception 'Renaming an approved listing did not send it back to review';
  end if;
end;
$$;

reset role;
rollback;
