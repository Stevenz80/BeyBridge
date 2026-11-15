-- Run with psql -v ON_ERROR_STOP=1 on a fully migrated local/staging DB.
-- All assertions are scoped to generated fixtures, including on hosted data.
begin;
create temporary table reply_test_context (
  owner_id uuid default gen_random_uuid(), customer_id uuid default gen_random_uuid(),
  stranger_id uuid default gen_random_uuid(), listing_id text default gen_random_uuid()::text,
  review_id uuid, request_id uuid, category_id bigint
) on commit drop;
insert into reply_test_context (category_id) select coalesce(max(id), 0) + 1 from public.categories;
insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
select id, id || '@example.invalid', '{"full_name":"Reply test user"}'::jsonb, now(), now()
from reply_test_context c cross join lateral (values (c.owner_id), (c.customer_id), (c.stranger_id)) u(id);
insert into public.categories (id, name) select category_id, 'Reply test ' || listing_id from reply_test_context;
insert into public.providers (id, owner_id, category_id, name, description, address, area, phone, opening_hours, listing_status)
select listing_id, owner_id, category_id, 'Reply Test Business', 'A complete listing used for rollback-safe reply regression tests.',
  'Test Street', 'Beirut', '+96170000003', '{"mon":"9:00-18:00"}'::jsonb, 'published' from reply_test_context;

select set_config('request.jwt.claim.sub', (select customer_id::text from reply_test_context), true);
with inserted as (
  insert into public.service_requests (provider_id, description, service_address)
  select listing_id, 'Please repair the sink for this regression test.', 'Test address' from reply_test_context returning id
) update reply_test_context set request_id = (select id from inserted);
select set_config('request.jwt.claim.sub', (select owner_id::text from reply_test_context), true);
update public.service_requests set status = 'accepted' where id = (select request_id from reply_test_context);
update public.service_requests set status = 'in_progress' where id = (select request_id from reply_test_context);
update public.service_requests set status = 'completed' where id = (select request_id from reply_test_context);
select set_config('request.jwt.claim.sub', (select customer_id::text from reply_test_context), true);
with inserted as (
  insert into public.reviews (provider_id, author_name, rating, comment)
  select listing_id, 'Reply Customer', 4, 'The service was professional and on time.' from reply_test_context returning id
) update reply_test_context set review_id = (select id from inserted);

-- Existing notification insert trigger must also enqueue a push for this kind.
insert into public.push_tokens (user_id, expo_push_token, platform)
select customer_id, 'ExponentPushToken[' || customer_id || ']', 'android' from reply_test_context;
grant select on reply_test_context to anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.reply_to_review(uuid,text)', 'execute')
    or has_function_privilege('anon', 'public.delete_review_reply(uuid)', 'execute')
    or has_table_privilege('authenticated', 'public.review_replies', 'insert')
    or has_table_privilege('authenticated', 'public.review_replies', 'update')
    or has_table_privilege('authenticated', 'public.review_replies', 'delete') then
    raise exception 'Untrusted clients have direct reply write privileges';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select owner_id::text from reply_test_context), true);
do $$
declare bad_body text;
begin
  foreach bad_body in array array[null, '', E' \n\t ', U&'\00A0\FEFF', 'x', repeat('x', 1001)] loop
    begin
      perform public.reply_to_review((select review_id from reply_test_context), bad_body);
      raise exception 'Invalid reply accepted';
    exception when raise_exception then
      if sqlerrm not in ('Use at least 2 characters for your reply.', 'Keep your reply within 1000 characters.') then raise; end if;
    end;
  end loop;
end;
$$;
select public.reply_to_review((select review_id from reply_test_context), E' \nThank you!\r\n\r\n\r\nSee you soon. \t');
do $$
begin
  if not exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)
    and body = E'Thank you!\n\nSee you soon.' and owner_id = (select owner_id from reply_test_context)
    and provider_id = (select listing_id from reply_test_context)) then
    raise exception 'Owner reply was not normalized and saved';
  end if;
end;
$$;
select public.reply_to_review((select review_id from reply_test_context), 'شكراً لثقتكم بنا');
select public.reply_to_review((select review_id from reply_test_context), 'ab');
select public.reply_to_review((select review_id from reply_test_context), repeat('x', 1000));
select public.reply_to_review((select review_id from reply_test_context), 'Updated public reply');

select set_config('request.jwt.claim.sub', (select customer_id::text from reply_test_context), true);
do $$ begin
  if not exists (select 1 from public.user_notifications where kind = 'review_reply'
    and source_id = (select listing_id from reply_test_context)
    and route = '/provider/' || (select listing_id from reply_test_context)) then
    raise exception 'The review author cannot read their reply notification';
  end if;
end; $$;

-- Both the review author and an unrelated account are refused write access.
do $$
declare caller uuid;
begin
  for caller in select customer_id from reply_test_context union all select stranger_id from reply_test_context loop
    perform set_config('request.jwt.claim.sub', caller::text, true);
    if not exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)
      and body = 'Updated public reply') then raise exception 'Customer cannot see public reply'; end if;
    begin
      perform public.reply_to_review((select review_id from reply_test_context), 'Unauthorized reply');
      raise exception 'Non-owner saved a reply';
    exception when raise_exception then
      if sqlerrm <> 'Only the listing owner can manage review replies.' then raise; end if;
    end;
    begin
      perform public.delete_review_reply((select review_id from reply_test_context));
      raise exception 'Non-owner deleted a reply';
    exception when raise_exception then
      if sqlerrm <> 'Only the listing owner can manage review replies.' then raise; end if;
    end;
  end loop;
end;
$$;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.reply_to_review((select review_id from reply_test_context), 'No authenticated user');
    raise exception 'Missing identity accepted';
  exception when raise_exception then
    if sqlerrm <> 'Sign in to manage review replies.' then raise; end if;
  end;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.review_replies where review_id = (select review_id from reply_test_context)) <> 1 then
    raise exception 'Public reply is not visible to anonymous readers';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.user_notifications where user_id = (select customer_id from reply_test_context)
    and kind = 'review_reply' and source_event = 'review_reply_' || (select review_id::text from reply_test_context)) <> 1 then
    raise exception 'Reply notification was missing or duplicated after edits';
  end if;
  if (select count(*) from public.push_deliveries d join public.user_notifications n on n.id = d.notification_id
    where n.user_id = (select customer_id from reply_test_context) and n.kind = 'review_reply') <> 1 then
    raise exception 'Reply push was missing or duplicated';
  end if;
end;
$$;

-- Even after acquiring a listing, an author cannot reply to their own review.
savepoint before_ownership_change;
update public.providers set owner_id = (select customer_id from reply_test_context)
where id = (select listing_id from reply_test_context);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select customer_id::text from reply_test_context), true);
do $$ begin
  begin
    perform public.reply_to_review((select review_id from reply_test_context), 'Self reply');
    raise exception 'Owner replied to their own review';
  exception when raise_exception then
    if sqlerrm <> 'You cannot reply to your own review.' then raise; end if;
  end;
end; $$;
reset role;
rollback to savepoint before_ownership_change;

-- Blocks in either direction must prevent notification-based contact.
savepoint before_block;
insert into public.user_blocks (user_id, blocked_user_id, display_name)
select customer_id, owner_id, 'Reply Test Business' from reply_test_context;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_id::text from reply_test_context), true);
do $$ begin
  begin
    perform public.reply_to_review((select review_id from reply_test_context), 'Blocked reply');
    raise exception 'Owner bypassed a customer block';
  exception when raise_exception then
    if sqlerrm <> 'You cannot reply to a blocked customer.' then raise; end if;
  end;
end; $$;
reset role;
rollback to savepoint before_block;

-- Suspension hides replies publicly and blocks saves, but still allows removal.
update public.providers set moderation_status = 'suspended' where id = (select listing_id from reply_test_context);
set local role anon;
do $$ begin
  if exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)) then
    raise exception 'Suspended listing reply leaked publicly';
  end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_id::text from reply_test_context), true);
do $$ begin
  begin
    perform public.reply_to_review((select review_id from reply_test_context), 'Suspended reply');
    raise exception 'Suspended owner saved a reply';
  exception when raise_exception then
    if sqlerrm <> 'Suspended listings cannot reply to reviews.' then raise; end if;
  end;
end; $$;
select public.delete_review_reply((select review_id from reply_test_context));
do $$ begin
  if exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)) then
    raise exception 'Owner deletion did not remove reply';
  end if;
end; $$;
reset role;
update public.providers set moderation_status = 'active' where id = (select listing_id from reply_test_context);
set local role authenticated;
select public.reply_to_review((select review_id from reply_test_context), 'Reposted reply');
reset role;
do $$ begin
  if (select count(*) from public.user_notifications where user_id = (select customer_id from reply_test_context)
    and kind = 'review_reply') <> 1 then raise exception 'Reposting duplicated the notification'; end if;
end; $$;

-- Review deletion (including moderation) cascades; account cleanup also works.
savepoint before_review_delete;
delete from public.reviews where id = (select review_id from reply_test_context);
do $$ begin
  if exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)) then
    raise exception 'Deleting a review did not cascade';
  end if;
end; $$;
rollback to savepoint before_review_delete;
savepoint before_customer_delete;
select public.begin_account_deletion((select customer_id from reply_test_context));
select public.delete_account_records((select customer_id from reply_test_context));
do $$ begin
  if exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)) then
    raise exception 'Customer account cleanup did not remove reply';
  end if;
end; $$;
rollback to savepoint before_customer_delete;
select public.begin_account_deletion((select owner_id from reply_test_context));
set local role authenticated;
do $$ begin
  begin
    perform public.reply_to_review((select review_id from reply_test_context), 'Reply while deleting');
    raise exception 'Deleting account saved a reply';
  exception when raise_exception then
    if sqlerrm <> 'Your account is being deleted.' then raise; end if;
  end;
end; $$;
reset role;
select public.delete_account_records((select owner_id from reply_test_context));
do $$ begin
  if exists (select 1 from public.review_replies where review_id = (select review_id from reply_test_context)) then
    raise exception 'Owner account cleanup did not remove reply';
  end if;
end; $$;
rollback;
