-- Morning summary for the boss at 08:15: last night's shift in one alert.
create or replace function private.rand(c numeric) returns text language sql immutable as $$
  select case when c < 0 then '-' else '' end || 'R' || to_char(abs(round(c / 100)), 'FM999,999,990') $$;

create or replace function private.morning_summary(p_now timestamptz) returns table (staff_id uuid, title text, body text, tag text)
language plpgsql security definer set search_path = private, public as $$
declare
  local timestamp := p_now at time zone 'Africa/Johannesburg';
  today date := local::date;
  sh shifts%rowtype;
  total numeric; card numeric; exp numeric; n int; msg text;
begin
  if local::time < time '08:15' or local::time >= time '12:00' then return; end if;
  if exists (select 1 from settings where key = 'morning_summary_last' and value #>> '{}' = today::text) then return; end if;
  insert into settings (key, value) values ('morning_summary_last', to_jsonb(today::text))
    on conflict (key) do update set value = excluded.value;

  select * into sh from shifts where kind = 'night' and date = today - 1 order by opened_at desc limit 1;
  if not found then
    msg := 'No night shift was recorded for ' || to_char(today - 1, 'DD Mon') || '.';
  else
    select coalesce(sum((select sum((l->>'qty')::numeric * (l->>'unitCents')::numeric) from jsonb_array_elements(x.lines) l)), 0),
           coalesce(sum((select sum((p->>'cents')::numeric) from jsonb_array_elements(x.payments) p where p->>'method' = 'card')), 0),
           count(*)
      into total, card, n
      from sales x where x.shift_id = sh.id and (x.void is null or x.void = 'null'::jsonb);
    select coalesce(sum(cents), 0) into exp from expenses where shift_id = sh.id;
    msg := 'Night ' || to_char(sh.date, 'DD Mon') || ' (' || (select string_agg(split_part(s.name, ' ', 1), ' + ')
             from staff s where s.id = sh.opened_by or s.id = any(coalesce(sh.helpers, '{}'))) || '): '
      || rand(total) || ' from ' || n || case when n = 1 then ' sale' else ' sales' end || ' · card ' || rand(card) || ' · cash ' || rand(total - card)
      || case when sh.cash_counted_cents is not null
           then ' · cash ' || case when sh.cash_counted_cents - (sh.float_cents + total - card - exp) = 0 then 'matches'
                else 'off by ' || rand(sh.cash_counted_cents - (sh.float_cents + total - card - exp)) end else '' end
      || case when sh.locked_at is null then ' · NOT LOCKED yet'
              when sh.sent_at is null then ' · report not sent' else ' · report sent' end
      || coalesce(' · ' || (select count(*) from moves m where m.shift_id = sh.id and m.kind = 'out' and m.status = 'rejected') || ' rejected stock out', '');
    msg := replace(msg, ' · 0 rejected stock out', '');
  end if;
  return query select s.id, 'Good morning: last night'::text, msg, 'morning-' || today from staff s where s.active and s.role = 'boss';
end $$;
revoke execute on function private.morning_summary(timestamptz) from public, anon, authenticated;
revoke execute on function private.rand(numeric) from public, anon, authenticated;

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
  -- Morning summary: the boss.
  return query select * from private.morning_summary(p_now);
end $function$;
revoke execute on function public.claim_due_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_notifications(timestamptz) to service_role;
