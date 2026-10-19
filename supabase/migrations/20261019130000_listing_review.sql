-- Listings created by providers are reviewed by an administrator before
-- customers can see or contact them. Approved listings go back to review when
-- the owner changes who the business is or how customers reach it.

alter table public.providers
  add column review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column review_note text not null default '' check (char_length(review_note) <= 1000),
  add column reviewed_at timestamptz;

comment on column public.providers.review_status is
  'Administrator review of owner listings. Imports and existing listings are approved; owner edits reset it.';

-- Owners cannot write these columns: insert/update grants are column-level and
-- do not include them. This trigger sets them for owner actions.
create or replace function private.require_listing_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only direct client writes. SECURITY DEFINER functions (the admin decision,
  -- importers) run as the function owner even though the JWT role is still
  -- 'authenticated', so auth.role() must not be used here.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.review_status := 'pending';
    new.review_note := '';
    new.reviewed_at := null;
  elsif old.review_status = 'rejected'
    or new.name is distinct from old.name
    or new.category_id is distinct from old.category_id
    or new.description is distinct from old.description
    or new.phone is distinct from old.phone
    or new.whatsapp is distinct from old.whatsapp
    or new.address is distinct from old.address
    or new.area is distinct from old.area then
    -- Editing a rejected listing resubmits it.
    new.review_status := 'pending';
    new.review_note := '';
    new.reviewed_at := null;
  else
    new.review_status := old.review_status;
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;

revoke all on function private.require_listing_review() from public, anon, authenticated;

drop trigger if exists providers_require_review on public.providers;
create trigger providers_require_review
before insert or update on public.providers
for each row execute function private.require_listing_review();

-- Only approved listings are public. Owners and administrators still see theirs.
drop policy if exists "active published providers are anonymously readable" on public.providers;
create policy "active published providers are anonymously readable"
on public.providers for select to anon
using (listing_status = 'published' and moderation_status = 'active' and review_status = 'approved');

drop policy if exists "authenticated users can read available or managed providers" on public.providers;
create policy "authenticated users can read available or managed providers"
on public.providers for select to authenticated
using (
  (listing_status = 'published' and moderation_status = 'active' and review_status = 'approved')
  or owner_id = (select auth.uid())
  or exists (select 1 from public.platform_admins where platform_admins.user_id = (select auth.uid()))
);

-- Customers cannot contact a listing that is not approved, even by id.
drop policy if exists "only approved listings accept requests" on public.service_requests;
create policy "only approved listings accept requests"
on public.service_requests as restrictive for insert to authenticated
with check (exists (
  select 1 from public.providers
  where providers.id = provider_id and providers.review_status = 'approved'
));

create or replace function public.review_provider_listing(p_provider_id text, p_decision text, p_note text default '')
returns public.providers
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_note text := trim(coalesce(p_note, ''));
  listing public.providers;
begin
  if not exists (select 1 from public.platform_admins where user_id = current_user_id) then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject';
  end if;
  if p_decision = 'rejected' and char_length(clean_note) not between 10 and 1000 then
    raise exception 'Explain what the provider must change (10 to 1000 characters)';
  end if;

  update public.providers
  set review_status = p_decision, review_note = clean_note, reviewed_at = now()
  where id = p_provider_id and owner_id is not null and review_status = 'pending'
  returning * into listing;

  if listing.id is null then
    raise exception 'This listing is not waiting for review';
  end if;

  insert into public.user_notifications (user_id, kind, title, body, route, source_type, source_id, source_event)
  values (
    listing.owner_id,
    'provider_moderation',
    case when p_decision = 'approved' then 'Your listing is live' else 'Your listing needs changes' end,
    left(case when p_decision = 'approved'
      then listing.name || ' was approved and is now visible to customers.'
      else listing.name || ': ' || clean_note end, 500),
    '/business',
    'provider',
    listing.id,
    'listing_review_' || p_decision || '_' || floor(extract(epoch from now()))::text
  )
  on conflict do nothing;

  return listing;
end;
$$;

revoke all on function public.review_provider_listing(text, text, text) from public, anon;
grant execute on function public.review_provider_listing(text, text, text) to authenticated;
