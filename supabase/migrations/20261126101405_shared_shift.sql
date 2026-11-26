-- Two people can work one shift: helpers join the open shift and sell into it.
alter table public.shifts add column if not exists helpers uuid[] not null default '{}';

create or replace function private.shift_visible(s uuid) returns boolean language sql stable security definer set search_path = private, public as $$
  select is_lead() or exists (
    select 1 from shifts where id = s and (opened_by = my_staff_id() or pin_in_by = my_staff_id() or my_staff_id() = any(helpers)))
  or s = (select id from shifts where locked_at is not null order by locked_at desc limit 1)
$$;

create or replace function private.shift_writable(s uuid) returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from shifts where id = s and locked_at is null and (opened_by = my_staff_id() or my_staff_id() = any(helpers) or is_lead()))
$$;

drop policy shifts_update on public.shifts;
create policy shifts_update on public.shifts for update to authenticated
  using (private.is_boss() or opened_by = private.my_staff_id() or pin_in_by = private.my_staff_id() or private.my_staff_id() = any(helpers) or private.is_lead())
  with check (private.is_boss() or opened_by = private.my_staff_id() or pin_in_by = private.my_staff_id() or private.my_staff_id() = any(helpers) or private.is_lead());

-- Helpers only change through join_open_shift (a phone's normal shift updates never touch them).
create or replace function private.guard_shift_update() returns trigger
language plpgsql security definer set search_path = private, public as $$
declare skip text[] := array['sent_at','reminded_at','alerted_at','low_alerted_at'];
begin
  if new.helpers is distinct from old.helpers and coalesce(current_setting('shiftpos.helper_join', true), '') <> '1' then
    new.helpers := old.helpers;
  end if;
  if old.locked_at is not null and not is_boss() then
    if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then raise exception 'This shift is locked'; end if;
  end if;
  if new.locked_at is not null and old.locked_at is null and exists (select 1 from moves where shift_id = new.id and status = 'pending') then
    raise exception 'Cannot lock: a stock out is waiting for approval';
  end if;
  if new.locked_at is not null and old.locked_at is null and
     (new.cash_counted_cents is null or new.card_slip_cents is null or new.pin_out_by is null or new.pin_in_by is null) then
    raise exception 'Cannot lock: cash count, card slip and both PINs are needed';
  end if;
  return new;
end $$;

create function public.join_open_shift() returns uuid
language plpgsql security definer set search_path = private, public as $$
declare me uuid := my_staff_id(); sid uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select id into sid from shifts where locked_at is null order by opened_at limit 1;
  if sid is null then return null; end if;
  perform set_config('shiftpos.helper_join', '1', true);
  update shifts set helpers = array_append(helpers, me) where id = sid and opened_by <> me and not (me = any(helpers));
  insert into audit (by_staff, action, ref) values (me, 'join_shift', sid::text);
  return sid;
end $$;
revoke execute on function public.join_open_shift() from public, anon;
grant execute on function public.join_open_shift() to authenticated;
revoke execute on function private.guard_shift_update() from public, anon, authenticated;

-- The clock-in banner should not show for someone who already joined.
create or replace function public.open_shift_owner() returns text
language sql stable security definer set search_path = private, public as $$
  select st.name from shifts s join staff st on st.id = s.opened_by
  where s.locked_at is null and s.opened_by is distinct from my_staff_id() and not (coalesce(my_staff_id() = any(s.helpers), false))
  order by s.opened_at limit 1
$$;
