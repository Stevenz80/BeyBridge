-- Run with psql -v ON_ERROR_STOP=1 on a migrated local/staging Supabase DB.
-- Fixtures and even Auth/Storage metadata changes are rolled back. No real
-- object bytes are created or removed; the Storage API needs separate QA.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  listing_id text := gen_random_uuid()::text;
  category_id bigint;
  request_id uuid;
  verification_id uuid;
  review_id uuid;
  report_id uuid;
  evidence_path text;
begin
  if has_function_privilege('authenticated', 'public.delete_account_records(uuid)', 'execute')
    or has_function_privilege('anon', 'public.begin_account_deletion(uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.account_deletion_files(uuid)', 'execute') then
    raise exception 'Account deletion helpers are accessible to untrusted clients';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
  values (owner_id, owner_id || '@example.invalid', '{"full_name":"Deletion provider","account_type":"provider"}', now(), now()),
    (customer_id, customer_id || '@example.invalid', '{"full_name":"Deletion customer"}', now(), now()),
    (admin_id, admin_id || '@example.invalid', '{"full_name":"Deletion admin"}', now(), now());
  insert into public.platform_admins (user_id) values (admin_id);
  select coalesce(max(id), 0) + 1 into category_id from public.categories;
  insert into public.categories (id, name) values (category_id, 'Deletion test ' || listing_id);
  insert into public.providers (id, owner_id, category_id, name, description, address, area, phone, opening_hours, listing_status)
  values (listing_id, owner_id, category_id, 'Deletion provider', 'A complete listing for rollback-safe account deletion testing.',
    'Test address', 'Test area', '+9613123456', '{"mon":"09:00–18:00"}', 'published');

  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  insert into public.service_requests (provider_id, description, service_address)
    values (listing_id, 'Please repair the plumbing at this private test address.', 'Private test address') returning id into request_id;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  update public.service_requests set status = 'accepted' where id = request_id;
  update public.service_requests set status = 'in_progress' where id = request_id;
  update public.service_requests set status = 'completed' where id = request_id;
  insert into public.provider_verification_requests (provider_id, evidence_summary)
    values (listing_id, 'Private verification evidence used only for rollback-safe testing.') returning id into verification_id;
  evidence_path := owner_id::text || '/' || verification_id::text || '/proof.pdf';
  insert into storage.objects (bucket_id, name, owner_id) values ('provider-verification', evidence_path, owner_id::text);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.provider_verification_requests set status = 'approved', admin_note = 'Verified for rollback-safe testing.' where id = verification_id;

  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  insert into public.reviews (user_id, provider_id, author_name, rating, comment)
    values (customer_id, listing_id, 'Deletion customer', 2, 'A test review that will be moderated.') returning id into review_id;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.reports (target_type, provider_id, review_id, reason, details)
    values ('review', listing_id, review_id, 'abuse', 'This review requires administrator moderation.') returning id into report_id;
  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  begin
    perform public.remove_reported_review(report_id, 'Attempt by an unauthorized customer.');
    raise exception 'A customer removed a reported review';
  exception when raise_exception then
    if sqlerrm <> 'Administrator access required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform public.remove_reported_review(report_id, 'Removed after a documented moderation review.');
  if exists (select 1 from public.reviews where id = review_id)
    or not exists (select 1 from public.reports r where r.id = report_id and r.review_id is null and r.status = 'resolved' and r.target_user_id = customer_id) then
    raise exception 'Review moderation did not preserve a linked, resolved report';
  end if;

  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  execute 'set local role authenticated';
  insert into public.user_blocks (user_id, blocked_user_id, display_name) values (customer_id, owner_id, 'Deletion provider');
  if not public.users_are_blocked(owner_id) then raise exception 'Outgoing block not enforced'; end if;
  begin
    insert into public.service_requests (provider_id, description, service_address)
      values (listing_id, 'A request that must be blocked by the database.', 'Test address');
    raise exception 'Blocked customer created a new request';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  if not public.users_are_blocked(customer_id) then raise exception 'Incoming block not enforced'; end if;
  if exists (select 1 from public.user_blocks where user_id = customer_id) then
    raise exception 'Another account could read a private block list';
  end if;
  execute 'reset role';

  -- Admin deletion must not be stopped by guarded ON DELETE SET NULL updates.
  perform public.begin_account_deletion(admin_id);
  perform public.delete_account_records(admin_id);
  delete from auth.users where id = admin_id;
  if exists (select 1 from public.provider_verification_requests where reviewed_by = admin_id)
    or exists (select 1 from public.reports where reviewed_by = admin_id) then
    raise exception 'Deleted administrator identity remained linked';
  end if;

  perform public.begin_account_deletion(owner_id);
  perform public.begin_account_deletion(owner_id); -- retry is idempotent
  begin
    perform public.delete_account_records(owner_id);
    raise exception 'Account records were deleted before verification files';
  exception when raise_exception then
    if sqlerrm <> 'Verification files must be removed first' then raise; end if;
  end;
  if not exists (select 1 from public.providers where id = listing_id) then
    raise exception 'Failed storage cleanup still removed the listing';
  end if;
  -- Metadata-only fixture cleanup, never use this instead of Storage.remove.
  delete from storage.objects where bucket_id = 'provider-verification' and name = evidence_path;
  perform public.delete_account_records(owner_id);
  perform public.delete_account_records(owner_id); -- partial Auth failure may retry
  delete from auth.users where id = owner_id;
  if exists (select 1 from public.providers where id = listing_id)
    or exists (select 1 from public.service_requests where id = request_id)
    or exists (select 1 from public.user_notifications where source_id in (request_id::text, listing_id, verification_id::text, report_id::text))
    or exists (select 1 from public.profiles where id = owner_id)
    or exists (select 1 from public.user_blocks where blocked_user_id = owner_id) then
    raise exception 'Deletion left associated account data or copied notifications';
  end if;
  if not exists (select 1 from auth.users where id = customer_id) then
    raise exception 'Deleting a provider removed the other participant account';
  end if;
end;
$$;
rollback;
