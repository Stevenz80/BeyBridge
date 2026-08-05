create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

revoke all on schema cron from public, anon, authenticated;
revoke all on schema net from public, anon, authenticated;

comment on extension pg_cron is
  'Runs the trusted push-delivery worker on a fixed schedule.';

comment on extension pg_net is
  'Invokes the push-delivery Edge Function from the database scheduler.';
