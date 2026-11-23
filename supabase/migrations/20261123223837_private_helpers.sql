-- Move the security helpers out of the API-exposed "public" schema.
-- Policies keep working (they point at the functions, not their names).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.my_staff_id() set schema private;
alter function public.my_role() set schema private;
alter function public.is_lead() set schema private;
alter function public.is_boss() set schema private;
alter function public.shift_visible(uuid) set schema private;
alter function public.shift_writable(uuid) set schema private;
alter function public.guard_shift_update() set schema private;
alter function public.guard_move_update() set schema private;
alter function public.guard_sale_update() set schema private;

alter function private.my_staff_id() set search_path = private, public;
alter function private.my_role() set search_path = private, public;
alter function private.is_lead() set search_path = private, public;
alter function private.is_boss() set search_path = private, public;
alter function private.shift_visible(uuid) set search_path = private, public;
alter function private.shift_writable(uuid) set search_path = private, public;
alter function private.guard_shift_update() set search_path = private, public;
alter function private.guard_move_update() set search_path = private, public;
alter function private.guard_sale_update() set search_path = private, public;

revoke execute on all functions in schema private from public, anon, authenticated;
-- Policies run as the signed-in user, so these few must stay callable by them.
grant execute on function private.my_staff_id(), private.my_role(), private.is_lead(), private.is_boss(),
  private.shift_visible(uuid), private.shift_writable(uuid) to authenticated;
