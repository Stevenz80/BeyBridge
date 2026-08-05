alter table public.push_tokens
  add constraint push_tokens_expo_format_check
  check (expo_push_token ~ '^Expo(nent)?PushToken\[.+\]$');

create trigger push_tokens_set_updated_at
before update on public.push_tokens
for each row execute function private.set_updated_at();

grant insert (
  user_id,
  expo_push_token,
  platform,
  device_name,
  app_version,
  enabled
) on public.push_tokens to authenticated;

grant update (
  platform,
  device_name,
  app_version,
  enabled
) on public.push_tokens to authenticated;

grant delete on public.push_tokens to authenticated;

create policy "users can register their own push tokens"
on public.push_tokens for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "users can update their own push tokens"
on public.push_tokens for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users can delete their own push tokens"
on public.push_tokens for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default '',
  p_app_version text default ''
)
returns public.push_tokens
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_token text := trim(p_expo_push_token);
  registered_token public.push_tokens;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to register notifications';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'Push notifications are only available on Android and iOS';
  end if;

  if char_length(clean_token) not between 20 and 512
    or clean_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    enabled
  ) values (
    current_user_id,
    clean_token,
    p_platform,
    left(coalesce(trim(p_device_name), ''), 120),
    left(coalesce(trim(p_app_version), ''), 50),
    true
  )
  on conflict (expo_push_token) do update
  set
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true
  returning * into registered_token;

  return registered_token;
end;
$$;

alter function public.unregister_push_token(text) security invoker;
alter function public.get_provider_analytics(integer) security invoker;

comment on constraint push_tokens_expo_format_check on public.push_tokens is
  'Only Expo Push Service token formats can be stored.';
