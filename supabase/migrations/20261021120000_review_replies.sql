-- One public response per review. Only the listing's current owner may write it.
create table public.review_replies (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  provider_id text not null references public.providers (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index review_replies_provider_id_idx on public.review_replies (provider_id);
create index review_replies_owner_id_idx on public.review_replies (owner_id);
create trigger review_replies_set_updated_at before update on public.review_replies
for each row execute function private.set_updated_at();

revoke all on public.review_replies from public, anon, authenticated;
grant select on public.review_replies to anon, authenticated;
grant all on public.review_replies to service_role;
alter table public.review_replies enable row level security;
create policy "replies follow review and listing visibility"
on public.review_replies for select to anon, authenticated
using (exists (
  select 1 from public.reviews r join public.providers p on p.id = r.provider_id
  where r.id = review_replies.review_id and p.id = review_replies.provider_id
));

alter table public.user_notifications drop constraint user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check check (kind in (
  'request_created', 'request_status', 'verification_submitted', 'verification_status',
  'report_status', 'provider_moderation', 'push_test', 'review_reply'
));

create function public.reply_to_review(p_review_id uuid, p_body text)
returns public.review_replies
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_body text;
  target_review public.reviews;
  listing public.providers;
  had_reply boolean;
  saved public.review_replies;
begin
  if current_user_id is null then
    raise exception 'Sign in to manage review replies.';
  end if;
  if public.account_is_deleting() then raise exception 'Your account is being deleted.'; end if;
  -- Match client normalization, including whitespace-only input and CRLF.
  clean_body := regexp_replace(coalesce(p_body, ''), E'\r\n?', E'\n', 'g');
  -- ECMAScript trim whitespace, including nonbreaking spaces and the BOM.
  clean_body := btrim(clean_body, E' \t\n\r\f\013' ||
    U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  clean_body := regexp_replace(clean_body, E'\n([\t ]*\n){2,}', E'\n\n', 'g');
  if char_length(clean_body) < 2 then
    raise exception 'Use at least 2 characters for your reply.';
  elsif char_length(clean_body) > 1000 then
    raise exception 'Keep your reply within 1000 characters.';
  end if;

  -- Serialize saves/deletes, including concurrent first replies. Hold the listing
  -- against ownership/moderation changes until the transaction finishes.
  select * into target_review from public.reviews where id = p_review_id for update;
  if not found then raise exception 'This review is no longer available.'; end if;
  select * into listing from public.providers where id = target_review.provider_id for share;
  if listing.owner_id is distinct from current_user_id then
    raise exception 'Only the listing owner can manage review replies.';
  end if;
  if target_review.user_id = current_user_id then
    raise exception 'You cannot reply to your own review.';
  end if;
  if public.users_are_blocked(target_review.user_id) then
    raise exception 'You cannot reply to a blocked customer.';
  end if;
  if listing.moderation_status = 'suspended' then
    raise exception 'Suspended listings cannot reply to reviews.';
  end if;

  select exists (select 1 from public.review_replies where review_id = p_review_id) into had_reply;
  insert into public.review_replies (review_id, provider_id, owner_id, body)
  values (p_review_id, listing.id, current_user_id, clean_body)
  on conflict (review_id) do update set body = excluded.body, owner_id = excluded.owner_id
  returning * into saved;

  if not had_reply and target_review.user_id is not null then
    insert into public.user_notifications (user_id, kind, title, body, route, source_type, source_id, source_event)
    values (target_review.user_id, 'review_reply', left(listing.name, 90) || ' replied to your review',
      left(clean_body, 200), '/provider/' || listing.id, 'provider', listing.id,
      'review_reply_' || p_review_id::text)
    on conflict do nothing;
  end if;
  return saved;
end;
$$;

create function public.delete_review_reply(p_review_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_review public.reviews;
  listing public.providers;
begin
  if current_user_id is null then raise exception 'Sign in to manage review replies.'; end if;
  select * into target_review from public.reviews where id = p_review_id for update;
  if not found then raise exception 'This review is no longer available.'; end if;
  select * into listing from public.providers where id = target_review.provider_id for share;
  if listing.owner_id is distinct from current_user_id then
    raise exception 'Only the listing owner can manage review replies.';
  end if;
  -- Allow removal even while suspended.
  delete from public.review_replies where review_id = p_review_id;
end;
$$;

revoke all on function public.reply_to_review(uuid, text) from public, anon;
revoke all on function public.delete_review_reply(uuid) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
grant execute on function public.delete_review_reply(uuid) to authenticated;

-- delete_account_records removes reviews before providers, so all three cascade
-- FKs cooperate with the existing account deletion and review moderation flows.
