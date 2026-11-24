-- Low-stock alert when a shift is locked.
alter table public.shifts add column if not exists low_alerted_at timestamptz;
update public.shifts set low_alerted_at = now() where locked_at is not null;

create or replace function private.guard_shift_update() returns trigger
language plpgsql security definer set search_path = private, public as $$
declare skip text[] := array['sent_at','reminded_at','alerted_at','low_alerted_at'];
begin
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

-- Lock → buzz right away (low stock), not only at the next minute.
create trigger shifts_notify after update of locked_at on public.shifts
  for each statement execute function private.ping_notify_trigger();

create or replace function public.claim_due_notifications(p_now timestamptz default now())
returns table (staff_id uuid, title text, body text, tag text)
language plpgsql security definer set search_path = private, public as $$
declare
  esc int := coalesce((select (value #>> '{}')::int from settings where key = 'escalate_after_min'), 5);
  rem int := coalesce((select (value #>> '{}')::int from settings where key = 'remind_sender_after_min'), 15);
  ale int := coalesce((select (value #>> '{}')::int from settings where key = 'alert_leads_after_min'), 30);
begin
  -- New stock out: the boss.
  return query with c as (
    update moves set notified_at = p_now where kind = 'out' and status = 'pending' and notified_at is null returning *)
  select s.id, 'Stock out needs your OK'::text, move_text(c), 'out-' || c.id
  from c join staff s on s.active and s.role = 'boss';

  -- Still waiting: managers and the boss.
  return query with c as (
    update moves set escalated_at = p_now
    where kind = 'out' and status = 'pending' and escalated_at is null and at <= p_now - make_interval(mins => esc) returning *)
  select s.id, ('Still waiting after ' || esc || ' min')::text, move_text(c), 'out-' || c.id
  from c join staff s on s.active and s.role in ('manager', 'boss');

  -- Decided: the person who asked.
  return query with c as (
    update moves set decision_notified_at = p_now
    where status in ('approved', 'rejected') and decision_notified_at is null and decided_at is not null returning *)
  select c.by_staff, ('Stock out ' || c.status)::text, move_text(c) || ' · by ' || coalesce((select name from staff where id = c.decided_by), '?'), 'out-' || c.id
  from c;

  -- Locked but not sent: first the person who locked it...
  return query with c as (
    update shifts set reminded_at = p_now
    where locked_at is not null and sent_at is null and reminded_at is null and locked_at <= p_now - make_interval(mins => rem) returning *)
  select coalesce(c.pin_out_by, c.opened_by), 'Send the shift report'::text,
    shift_text(c) || ' is locked but not sent. Open the app and tap Send to WhatsApp.', 'report-' || c.id
  from c;

  -- ...then the managers and the boss.
  return query with c as (
    update shifts set alerted_at = p_now
    where locked_at is not null and sent_at is null and alerted_at is null and locked_at <= p_now - make_interval(mins => ale) returning *)
  select s.id, 'Shift report not sent'::text,
    shift_text(c) || ' was locked ' || ale || ' min ago by ' || coalesce((select name from staff where id = coalesce(c.pin_out_by, c.opened_by)), '?') || ' but not sent.',
    'report-' || c.id
  from c join staff s on s.active and s.role in ('manager', 'boss');
  -- Low stock after a shift is locked: managers and the boss.
  return query with c as (
    update shifts sh set low_alerted_at = p_now
    where sh.locked_at is not null and sh.low_alerted_at is null returning sh.*),
  low as (
    select c.id, c.kind, c.date, string_agg(p.name || ' ' || trim(trailing '.' from trim(trailing '0' from (c.counts ->> p.id)))
           || case when p.unit = 'g' then ' g' else '' end, ', ' order by p.sort nulls last, p.name) as items
    from c join products p on p.active and c.counts ? p.id and (c.counts ->> p.id)::numeric <= p.low_at
    group by c.id, c.kind, c.date)
  select s.id, 'Low stock'::text, initcap(low.kind) || ' shift ' || to_char(low.date, 'DD Mon') || ' closed with: ' || low.items, 'low-' || low.id
  from low join staff s on s.active and s.role in ('manager', 'boss');
end $$;
revoke execute on function public.claim_due_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(timestamptz) to service_role;
