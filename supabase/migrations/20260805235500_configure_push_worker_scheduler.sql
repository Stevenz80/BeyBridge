create function private.configure_push_worker(
  p_project_url text,
  p_dispatch_secret text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_project_url text := rtrim(trim(p_project_url), '/');
  existing_secret_id uuid;
  scheduled_job_id bigint;
  worker_command text;
begin
  if clean_project_url !~ '^https://[a-z0-9.-]+$' then
    raise exception 'A valid HTTPS Supabase project URL is required';
  end if;

  if char_length(p_dispatch_secret) < 32
    or char_length(p_dispatch_secret) > 128
    or p_dispatch_secret !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'The push dispatch secret must be 32-128 URL-safe characters';
  end if;

  select secrets.id
  into existing_secret_id
  from vault.secrets as secrets
  where secrets.name = 'push_dispatch_secret';

  if existing_secret_id is null then
    perform vault.create_secret(
      p_dispatch_secret,
      'push_dispatch_secret',
      'Authenticates the scheduled Expo push worker.'
    );
  else
    perform vault.update_secret(
      existing_secret_id,
      p_dispatch_secret,
      'push_dispatch_secret',
      'Authenticates the scheduled Expo push worker.'
    );
  end if;

  perform cron.unschedule(jobs.jobid)
  from cron.job as jobs
  where jobs.jobname = 'process-push-notifications';

  worker_command := format(
    $command$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'push_dispatch_secret'
        )
      ),
      body := jsonb_build_object('mode', 'both'),
      timeout_milliseconds := 15000
    );
    $command$,
    clean_project_url || '/functions/v1/process-push-notifications'
  );

  scheduled_job_id := cron.schedule(
    'process-push-notifications',
    '* * * * *',
    worker_command
  );

  return scheduled_job_id;
end;
$$;

revoke all on function private.configure_push_worker(text, text)
from public, anon, authenticated, service_role;

comment on function private.configure_push_worker(text, text) is
  'Trusted deployment helper that rotates the Vault secret and schedules the Expo push worker.';
