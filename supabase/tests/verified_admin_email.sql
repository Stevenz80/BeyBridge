-- Rollback-safe regression checks; run against a migrated local/staging database.
begin;
do $$
declare
  test_user uuid := gen_random_uuid();
  allowed_email text := 'admin-confirmation-' || test_user::text || '@example.com';
begin
  insert into private.platform_admin_email_allowlist (email) values (allowed_email);
  insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
  values (test_user, allowed_email, '{"full_name":"Admin confirmation test"}'::jsonb, now(), now());
  if exists (select 1 from public.platform_admins where user_id = test_user) then
    raise exception 'Unverified email received administrator access';
  end if;

  update auth.users set email_confirmed_at = now() where id = test_user;
  if not exists (select 1 from public.platform_admins where user_id = test_user) then
    raise exception 'Email confirmation did not grant allowlisted administrator access';
  end if;

  update auth.users set email = 'other-' || allowed_email where id = test_user;
  if exists (select 1 from public.platform_admins where user_id = test_user) then
    raise exception 'Changing to a non-allowlisted email retained automatic administrator access';
  end if;

  update auth.users set email = allowed_email where id = test_user;
  if not exists (select 1 from public.platform_admins where user_id = test_user) then
    raise exception 'Confirmed allowlisted email was not restored';
  end if;

  update auth.users set email_confirmed_at = null where id = test_user;
  if exists (select 1 from public.platform_admins where user_id = test_user) then
    raise exception 'Removing confirmation retained automatic administrator access';
  end if;
end;
$$;
rollback;
