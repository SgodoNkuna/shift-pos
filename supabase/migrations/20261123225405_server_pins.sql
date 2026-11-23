-- Product order, server-checked PINs, approving stock out with a lead's PIN on another phone.

alter table public.products add column if not exists sort integer;

create extension if not exists pgcrypto with schema extensions;

-- PIN hashes live where the API cannot read them. Only the functions below touch them.
create table private.staff_pins (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  pin_hash text not null,
  failed integer not null default 0,
  locked boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on private.staff_pins from public, anon, authenticated;

create function public.set_my_pin(p_pin text) returns void
language plpgsql security definer set search_path = private, public, extensions as $$
begin
  if my_staff_id() is null then raise exception 'Not signed in'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'The PIN must be 4 numbers'; end if;
  insert into staff_pins (staff_id, pin_hash) values (my_staff_id(), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, failed = 0, locked = false, updated_at = now();
end $$;

-- 'ok' | 'wrong' | 'locked' | 'no_pin'. Five wrong tries lock the PIN until a lead resets it.
create function public.check_pin(p_staff uuid, p_pin text) returns text
language plpgsql security definer set search_path = private, public, extensions as $$
declare r staff_pins;
begin
  if my_staff_id() is null then raise exception 'Not signed in'; end if;
  select * into r from staff_pins where staff_id = p_staff for update;
  if not found then return 'no_pin'; end if;
  if r.locked then return 'locked'; end if;
  if r.pin_hash = crypt(coalesce(p_pin, ''), r.pin_hash) then
    update staff_pins set failed = 0 where staff_id = p_staff;
    return 'ok';
  end if;
  update staff_pins set failed = failed + 1, locked = failed + 1 >= 5 where staff_id = p_staff;
  return case when r.failed + 1 >= 5 then 'locked' else 'wrong' end;
end $$;

create function public.reset_pin_lock(p_staff uuid) returns void
language plpgsql security definer set search_path = private, public as $$
begin
  if not is_lead() then raise exception 'Only a manager or the boss can unlock a PIN'; end if;
  update staff_pins set failed = 0, locked = false where staff_id = p_staff;
end $$;

-- A manager or the boss approves on someone else's phone by typing their PIN.
create function public.decide_out_with_pin(p_move uuid, p_lead uuid, p_pin text, p_approve boolean) returns text
language plpgsql security definer set search_path = private, public as $$
declare res text;
begin
  if my_staff_id() is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from staff where id = p_lead and active and role in ('manager','boss')) then return 'not_lead'; end if;
  res := check_pin(p_lead, p_pin);
  if res <> 'ok' then return res; end if;
  perform set_config('shiftpos.pin_lead', p_lead::text, true);
  update moves set status = case when p_approve then 'approved' else 'rejected' end, decided_by = p_lead, decided_at = now()
   where id = p_move and status = 'pending';
  if not found then return 'not_pending'; end if;
  insert into audit (by_staff, action, ref, detail)
  values (my_staff_id(), case when p_approve then 'stock_out_approve_pin' else 'stock_out_reject_pin' end, p_move::text, jsonb_build_object('lead', p_lead));
  return 'ok';
end $$;

-- Let a PIN-checked decision through the move guard.
create or replace function private.guard_move_update() returns trigger
language plpgsql security definer set search_path = private, public as $$
begin
  if (to_jsonb(new) - array['status','decided_by','decided_at','escalated_at']) is distinct from
     (to_jsonb(old) - array['status','decided_by','decided_at','escalated_at']) then
    raise exception 'Stock moves cannot be edited';
  end if;
  if new.status is distinct from old.status then
    if not is_lead() and coalesce(current_setting('shiftpos.pin_lead', true), '') <> coalesce(new.decided_by::text, '-') then
      raise exception 'Only a manager or the boss can approve stock out';
    end if;
    if old.status <> 'pending' or new.status not in ('approved','rejected') then raise exception 'Already decided'; end if;
  end if;
  return new;
end $$;

revoke execute on function public.set_my_pin(text), public.check_pin(uuid, text), public.reset_pin_lock(uuid),
  public.decide_out_with_pin(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_my_pin(text), public.check_pin(uuid, text), public.reset_pin_lock(uuid),
  public.decide_out_with_pin(uuid, uuid, text, boolean) to authenticated;
revoke execute on function private.guard_move_update() from public, anon, authenticated;

-- Starting values the app reads.
insert into public.settings values ('float_cents', '0') on conflict (key) do nothing;
