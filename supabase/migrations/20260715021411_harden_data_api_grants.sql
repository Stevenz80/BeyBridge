alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

revoke all on table
  public.categories,
  public.providers,
  public.profiles,
  public.favorites,
  public.reviews
from anon, authenticated, service_role;

grant select on public.categories, public.providers, public.reviews to anon;

grant select on public.categories, public.providers to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

grant select, insert, update, delete on
  public.categories,
  public.providers,
  public.profiles,
  public.favorites,
  public.reviews
to service_role;
