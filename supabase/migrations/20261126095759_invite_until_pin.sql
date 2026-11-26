-- An invite stays usable until the person has saved a PIN (so an interrupted setup can be finished).
create function public.staff_has_pin(p_staff uuid) returns boolean
language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from private.staff_pins where staff_id = p_staff)
$$;
revoke execute on function public.staff_has_pin(uuid) from public, anon, authenticated;
grant execute on function public.staff_has_pin(uuid) to service_role;
