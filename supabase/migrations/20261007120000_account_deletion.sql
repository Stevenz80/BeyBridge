-- Only the authenticated Edge Function may start/finalize deletion. A durable
-- lock prevents verification uploads from racing file cleanup; retries reuse it.
-- Keep report ownership traceable after its original review is removed.
alter table public.reports add column target_user_id uuid references auth.users (id) on delete cascade;
create index reports_target_user_idx on public.reports (target_user_id) where target_user_id is not null;

create table private.account_deletions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
revoke all on private.account_deletions from public, anon, authenticated;

create function public.account_is_deleting()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.account_deletions where user_id = (select auth.uid()));
$$;
revoke all on function public.account_is_deleting() from public, anon;
grant execute on function public.account_is_deleting() to authenticated;

create policy "deleting accounts cannot upload evidence"
on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'provider-verification' or not public.account_is_deleting());

-- Stop new account-owned records while deletion runs, including after a
-- partial failure. Existing reads remain available so the user can retry.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'providers', 'favorites', 'reviews', 'service_requests',
    'provider_verification_requests', 'reports', 'push_tokens'
  ] loop
    execute format('create policy "deleting accounts cannot insert" on public.%I as restrictive for insert to authenticated with check (not public.account_is_deleting())', table_name);
  end loop;
end;
$$;

create function public.begin_account_deletion(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Account does not exist';
  end if;
  insert into private.account_deletions (user_id) values (p_user_id) on conflict do nothing;
end;
$$;

create function public.account_deletion_files(p_user_id uuid)
returns table (path text) language sql stable security definer set search_path = ''
as $$
  select name from storage.objects
  where bucket_id = 'provider-verification'
    and (owner_id = p_user_id::text or split_part(name, '/', 1) = p_user_id::text)
  order by name limit 250;
$$;

create function public.delete_account_records(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  provider_ids text[];
  review_ids uuid[];
  request_ids uuid[];
  verification_ids uuid[];
  report_ids uuid[];
begin
  perform 1 from auth.users where id = p_user_id for update;
  if not exists (select 1 from private.account_deletions where user_id = p_user_id) then
    raise exception 'Deletion has not been started';
  end if;
  if exists (
    select 1 from storage.objects where bucket_id = 'provider-verification'
      and (owner_id = p_user_id::text or split_part(name, '/', 1) = p_user_id::text)
  ) then raise exception 'Verification files must be removed first'; end if;

  select coalesce(array_agg(id), '{}'::text[]) into provider_ids
    from public.providers where owner_id = p_user_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into review_ids
    from public.reviews where user_id = p_user_id or provider_id = any(provider_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into request_ids
    from public.service_requests where customer_id = p_user_id
      or provider_owner_id = p_user_id or provider_id = any(provider_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into verification_ids
    from public.provider_verification_requests where provider_owner_id = p_user_id or provider_id = any(provider_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into report_ids
    from public.reports where reporter_id = p_user_id or target_user_id = p_user_id
      or provider_id = any(provider_ids) or review_id = any(review_ids);

  -- Notifications can contain copied names, request descriptions, and messages
  -- in another user's inbox. Remove them and their queued push deliveries too.
  delete from public.user_notifications where user_id = p_user_id
    or (source_type = 'provider' and source_id = any(provider_ids))
    or (source_type = 'service_request' and source_id = any(request_ids::text[]))
    or (source_type = 'verification_request' and source_id = any(verification_ids::text[]))
    or (source_type = 'report' and source_id = any(report_ids::text[]));
  delete from public.reports where id = any(report_ids);
  delete from public.provider_moderation_actions where provider_id = any(provider_ids);
  delete from public.provider_verification_requests where id = any(verification_ids);
  delete from public.service_requests where id = any(request_ids);
  delete from public.reviews where id = any(review_ids);
  delete from public.providers where id = any(provider_ids);
  delete from public.favorites where user_id = p_user_id;
  delete from public.push_tokens where user_id = p_user_id;
  delete from public.profiles where id = p_user_id;
  -- Auth removal is performed through GoTrue's admin API after this transaction.
  -- Its cascades clear identities, sessions, admin assignments and the lock.
end;
$$;

revoke all on function public.begin_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.account_deletion_files(uuid) from public, anon, authenticated;
revoke all on function public.delete_account_records(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
grant execute on function public.account_deletion_files(uuid) to service_role;
grant execute on function public.delete_account_records(uuid) to service_role;

create or replace function private.guard_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean;
begin
  -- A trusted SQL migration may backfill this new ownership link. Keep every
  -- other field immutable; authenticated clients cannot use this exception.
  if current_user in ('postgres', 'supabase_admin') and current_user_id is null
    and new.target_user_id is distinct from old.target_user_id
    and (to_jsonb(new) - 'target_user_id') = (to_jsonb(old) - 'target_user_id') then
    return new;
  end if;

  -- GoTrue removes an administrator. Allow only the
  -- foreign-key SET NULL, preserving the immutable audit entry and decision.
  if old.reviewed_by is not null and new.reviewed_by is null
    and not exists (select 1 from auth.users where id = old.reviewed_by)
    and (to_jsonb(new) - 'reviewed_by') = (to_jsonb(old) - 'reviewed_by') then
    return new;
  end if;

  -- Deleting a review must not be blocked by the report's immutable snapshot.
  if old.review_id is not null and new.review_id is null
    and not exists (select 1 from public.reviews where id = old.review_id)
    and (to_jsonb(new) - 'review_id') = (to_jsonb(old) - 'review_id') then
    return new;
  end if;

  select exists (
    select 1 from public.platform_admins where user_id = current_user_id
  ) into is_admin;

  if current_user_id is null or not is_admin then
    raise exception 'Administrator access is required to update reports';
  end if;

  if new.reporter_id is distinct from old.reporter_id
    or new.target_user_id is distinct from old.target_user_id
    or new.reporter_name is distinct from old.reporter_name
    or new.target_type is distinct from old.target_type
    or new.provider_id is distinct from old.provider_id
    or new.review_id is distinct from old.review_id
    or new.target_name is distinct from old.target_name
    or new.target_snapshot is distinct from old.target_snapshot
    or new.reason is distinct from old.reason
    or new.details is distinct from old.details
    or new.created_at is distinct from old.created_at then
    raise exception 'Report submission details are immutable';
  end if;

  if not (
    (old.status = 'open' and new.status in ('reviewing', 'resolved', 'dismissed'))
    or (old.status = 'reviewing' and new.status in ('resolved', 'dismissed'))
  ) then
    raise exception 'Unsupported report status change';
  end if;

  new.admin_note := trim(new.admin_note);
  new.reviewed_by := current_user_id;
  new.resolved_at := case
    when new.status in ('resolved', 'dismissed') then now()
    else null
  end;
  return new;
end;
$$;

create or replace function private.guard_verification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean;
begin
  -- GoTrue removes an administrator. Allow only the
  -- foreign-key SET NULL, preserving the immutable audit entry and decision.
  if old.reviewed_by is not null and new.reviewed_by is null
    and not exists (select 1 from auth.users where id = old.reviewed_by)
    and (to_jsonb(new) - 'reviewed_by') = (to_jsonb(old) - 'reviewed_by') then
    return new;
  end if;

  if current_user_id is null then
    raise exception 'Authentication is required to update verification';
  end if;

  select exists (
    select 1 from public.platform_admins where user_id = current_user_id
  ) into is_admin;

  if new.provider_id is distinct from old.provider_id
    or new.provider_owner_id is distinct from old.provider_owner_id
    or new.provider_name is distinct from old.provider_name
    or new.business_registration is distinct from old.business_registration
    or new.license_number is distinct from old.license_number
    or new.evidence_summary is distinct from old.evidence_summary
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Verification submission details are immutable';
  end if;

  if is_admin then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Administrators can only approve or reject pending verification';
    end if;
    new.admin_note := trim(new.admin_note);
    new.reviewed_by := current_user_id;
    new.reviewed_at := now();
  elsif old.provider_owner_id = current_user_id then
    if old.status <> 'pending' or new.status <> 'withdrawn' then
      raise exception 'Providers can only withdraw a pending verification request';
    end if;
    if new.admin_note is distinct from old.admin_note
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Providers cannot change administrator fields';
    end if;
  else
    raise exception 'You do not have access to update this verification request';
  end if;

  return new;
end;
$$;

-- Perform this only after the guarded migration-only update is installed.
with targets as (
  select r.id, case when r.target_type = 'provider' then p.owner_id else v.user_id end as user_id
  from public.reports r
  left join public.providers p on p.id = r.provider_id
  left join public.reviews v on v.id = r.review_id
)
update public.reports r set target_user_id = targets.user_id
from targets where r.id = targets.id and targets.user_id is not null
  and r.target_user_id is distinct from targets.user_id;
