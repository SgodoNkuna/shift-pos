-- Double shift: the person closing can be the next person. Managers and the boss are alerted.
alter table public.shifts add column if not exists self_alerted_at timestamptz;
update public.shifts set self_alerted_at = now() where locked_at is not null;

CREATE OR REPLACE FUNCTION private.guard_shift_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
declare skip text[] := array['sent_at','reminded_at','alerted_at','low_alerted_at','self_alerted_at'];
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
end $function$;

CREATE OR REPLACE FUNCTION public.claim_due_notifications(p_now timestamp with time zone DEFAULT now())
 RETURNS TABLE(staff_id uuid, title text, body text, tag text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
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
  -- Same person closed and is working the next shift: tell the managers and the boss.
  return query with c as (
    update shifts set self_alerted_at = p_now
    where locked_at is not null and self_alerted_at is null and pin_in_by = pin_out_by returning *)
  select s.id, 'Counted alone at handover'::text,
    coalesce((select name from staff where id = c.pin_out_by), '?') || ' closed ' || shift_text(c) || ' and is working the next shift. The count was done alone, without a second person.',
    'self-' || c.id
  from c join staff s on s.active and s.role in ('manager', 'boss');
  -- Morning summary: the boss.
  return query select * from private.morning_summary(p_now);
end $function$;
revoke execute on function public.claim_due_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(timestamptz) to service_role;
