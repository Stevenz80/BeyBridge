-- Keep the content owner's identity linked even when the review itself is
-- removed, so future account deletion also removes report snapshots.
create function private.set_report_target_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.target_user_id := case when new.target_type = 'provider'
    then (select owner_id from public.providers where id = new.provider_id)
    else (select user_id from public.reviews where id = new.review_id) end;
  return new;
end;
$$;
revoke all on function private.set_report_target_user() from public, anon, authenticated;
create trigger reports_set_target_user before insert on public.reports
for each row execute function private.set_report_target_user();

create function public.remove_reported_review(p_report_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_review uuid;
begin
  if not exists (select 1 from public.platform_admins where user_id = (select auth.uid())) then
    raise exception 'Administrator access required';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'Record a moderation reason of 10 to 1000 characters';
  end if;
  select review_id into target_review from public.reports
    where id = p_report_id and target_type = 'review' and status in ('open', 'reviewing') for update;
  if target_review is null then raise exception 'No active reported review to remove'; end if;
  delete from public.reviews where id = target_review;
  update public.reports set status = 'resolved', admin_note = trim(p_reason) where id = p_report_id;
end;
$$;
revoke all on function public.remove_reported_review(uuid, text) from public, anon;
grant execute on function public.remove_reported_review(uuid, text) to authenticated;
