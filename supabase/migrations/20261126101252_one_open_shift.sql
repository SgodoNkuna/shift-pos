-- Only one open shift at a time (unless "several sellers" is switched on).
create function private.guard_one_open_shift() returns trigger
language plpgsql security definer set search_path = private, public as $$
begin
  if new.locked_at is not null then return new; end if;
  if coalesce((select (value #>> '{}')::boolean from settings where key = 'multi_seller'), false) then return new; end if;
  if exists (select 1 from shifts where locked_at is null and id <> new.id) then
    raise exception 'Another shift is still open. Clock in after it is locked.';
  end if;
  return new;
end $$;
create trigger shifts_one_open before insert on public.shifts for each row execute function private.guard_one_open_shift();
revoke execute on function private.guard_one_open_shift() from public, anon, authenticated;

-- For the clock-in screen: whose shift is still open (not mine), if any.
create function public.open_shift_owner() returns text
language sql stable security definer set search_path = private, public as $$
  select st.name from shifts s join staff st on st.id = s.opened_by
  where s.locked_at is null and s.opened_by is distinct from my_staff_id()
  order by s.opened_at limit 1
$$;
revoke execute on function public.open_shift_owner() from public, anon;
grant execute on function public.open_shift_owner() to authenticated;
