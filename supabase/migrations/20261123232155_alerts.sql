-- Phone alerts ("the buzz"): who gets told what, and when.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.moves add column if not exists notified_at timestamptz, add column if not exists decision_notified_at timestamptz;
alter table public.shifts add column if not exists reminded_at timestamptz, add column if not exists alerted_at timestamptz;
-- Nothing that already happened should buzz anyone.
update public.moves set notified_at = now(), decision_notified_at = now();
update public.shifts set reminded_at = now(), alerted_at = now() where locked_at is not null;

-- One row per phone that turned alerts on.
create table public.push_subscriptions (
  endpoint text primary key,
  staff_id uuid not null references public.staff(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own_read on public.push_subscriptions for select to authenticated using (staff_id = private.my_staff_id());
create policy push_own_add on public.push_subscriptions for insert to authenticated with check (staff_id = private.my_staff_id());
create policy push_own_move on public.push_subscriptions for update to authenticated using (true) with check (staff_id = private.my_staff_id());
create policy push_own_remove on public.push_subscriptions for delete to authenticated using (staff_id = private.my_staff_id());

-- The alert bookkeeping columns may change on a locked shift or a decided move.
create or replace function private.guard_shift_update() returns trigger
language plpgsql security definer set search_path = private, public as $$
begin
  if old.locked_at is not null and not is_boss() then
    if (to_jsonb(new) - array['sent_at','reminded_at','alerted_at']) is distinct from (to_jsonb(old) - array['sent_at','reminded_at','alerted_at']) then
      raise exception 'This shift is locked';
    end if;
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

create or replace function private.guard_move_update() returns trigger
language plpgsql security definer set search_path = private, public as $$
declare skip text[] := array['status','decided_by','decided_at','escalated_at','notified_at','decision_notified_at'];
begin
  if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then raise exception 'Stock moves cannot be edited'; end if;
  if new.status is distinct from old.status then
    if not is_lead() and coalesce(current_setting('shiftpos.pin_lead', true), '') <> coalesce(new.decided_by::text, '-') then
      raise exception 'Only a manager or the boss can approve stock out';
    end if;
    if old.status <> 'pending' or new.status not in ('approved','rejected') then raise exception 'Already decided'; end if;
  end if;
  return new;
end $$;

-- "0.5 g Martian F (R75) · Wisani Nkuna · Given to boss"
create function private.move_text(m public.moves) returns text language sql stable set search_path = private, public as $$
  select trim(trailing '.' from trim(trailing '0' from m.qty::text)) || case when p.unit = 'g' then ' g ' else ' ' end || p.name
    || ' (R' || round(m.qty * p.price_cents / 100.0)::bigint || ') · ' || coalesce(s.name, '?') || coalesce(' · ' || m.reason, '')
  from products p, staff s where p.id = m.product_id and s.id = m.by_staff
$$;

create function private.shift_text(sh public.shifts) returns text language sql stable as $$
  select initcap(sh.kind) || ' shift ' || to_char(sh.date, 'DD Mon')
$$;

-- Claims every alert that is due and returns one row per person to buzz. Claiming marks it, so each alert goes out once.
create function public.claim_due_notifications(p_now timestamptz default now())
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
end $$;
revoke execute on function public.claim_due_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(timestamptz) to service_role;

-- Ask the notify function to send whatever is due. Safe to call any number of times.
create function private.ping_notify() returns void language plpgsql security definer set search_path = private, public, extensions as $$
declare secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret');
begin
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://qnlndzxlgfcoieqnpnfh.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    body := '{}'::jsonb);
end $$;

create function private.ping_notify_trigger() returns trigger language plpgsql security definer set search_path = private, public as $$
begin perform ping_notify(); return null; end $$;

-- Right away when a stock out is asked for or decided...
create trigger moves_notify after insert or update of status on public.moves
  for each statement execute function private.ping_notify_trigger();
-- ...and every minute for the timed alerts.
select cron.schedule('shift-pos-notify', '* * * * *', $$ select private.ping_notify() $$);

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_staff_id(), private.my_role(), private.is_lead(), private.is_boss(),
  private.shift_visible(uuid), private.shift_writable(uuid) to authenticated;
