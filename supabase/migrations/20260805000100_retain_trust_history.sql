alter table public.provider_verification_requests
  drop constraint provider_verification_requests_provider_id_fkey,
  add constraint provider_verification_requests_provider_id_fkey
    foreign key (provider_id) references public.providers (id) on delete restrict;

alter table public.provider_moderation_actions
  drop constraint provider_moderation_actions_provider_id_fkey,
  add constraint provider_moderation_actions_provider_id_fkey
    foreign key (provider_id) references public.providers (id) on delete restrict;

create or replace function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_name text;
  target_owner_id uuid;
  review_owner_id uuid;
  target_label text;
  target_content text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to submit a report';
  end if;

  if new.target_type = 'provider' then
    if new.provider_id is null or new.review_id is not null then
      raise exception 'Choose one provider to report';
    end if;

    select
      providers.owner_id,
      providers.name,
      concat_ws(
        E'\n',
        'Name: ' || providers.name,
        'Description: ' || providers.description,
        'Address: ' || providers.address,
        'Area: ' || providers.area,
        'Phone: ' || providers.phone
      )
      into target_owner_id, target_label, target_content
    from public.providers
    where providers.id = new.provider_id
      and providers.listing_status = 'published'
      and providers.moderation_status = 'active';

    if not found then
      raise exception 'This provider is not available to report';
    end if;
  elsif new.target_type = 'review' then
    if new.review_id is null then
      raise exception 'Choose one review to report';
    end if;

    select
      reviews.provider_id,
      reviews.user_id,
      reviews.author_name,
      concat_ws(
        E'\n',
        'Author: ' || reviews.author_name,
        'Rating: ' || reviews.rating::text || '/5',
        'Comment: ' || reviews.comment
      )
      into new.provider_id, review_owner_id, target_label, target_content
    from public.reviews
    where reviews.id = new.review_id;

    if not found then
      raise exception 'This review is not available to report';
    end if;
  else
    raise exception 'Unsupported report target';
  end if;

  if target_owner_id = current_user_id or review_owner_id = current_user_id then
    raise exception 'You cannot report your own content';
  end if;

  select profiles.full_name into profile_name
  from public.profiles
  where profiles.id = current_user_id;

  new.reporter_id := current_user_id;
  new.reporter_name := coalesce(nullif(trim(profile_name), ''), 'BeyBridge user');
  new.target_name := coalesce(nullif(trim(target_label), ''), 'Reported content');
  new.target_snapshot := coalesce(left(trim(target_content), 1200), '');
  new.status := 'open';
  new.admin_note := '';
  new.reviewed_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

revoke all on function private.prepare_report() from public, anon, authenticated;

comment on function private.prepare_report() is
  'Validates report ownership and preserves a bounded content snapshot for administrator review.';
