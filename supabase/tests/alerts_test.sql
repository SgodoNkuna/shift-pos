-- Alert timing tests at fixed times. Always rolls back; the message is the report.
do $$
declare
  t0 timestamptz := '2026-11-28 22:00:00+02';
  e uuid; m uuid; b uuid; s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid(); s4 uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); m3 uuid := gen_random_uuid();
  report text := ''; passed int := 0; failed int := 0; n int;
begin
  insert into staff (name, role) values ('T Emp','employee') returning id into e;
  insert into staff (name, role) values ('T Man','manager') returning id into m;
  insert into staff (name, role) values ('T Boss','boss') returning id into b;
  -- Real staff are in the table too; count only the test people.
  insert into products values ('t_martian','Martian F','main','g',0.5,1,15000,true,99) on conflict do nothing;
  insert into shifts (id,kind,date,opened_by,opened_at) values (s1,'night','2026-11-28',e,t0 - interval '2 hours');
  insert into shifts (id,kind,date,opened_by,opened_at,locked_at,pin_out_by,pin_in_by,cash_counted_cents,card_slip_cents,counts)
    values (s2,'day','2026-11-28',e,t0 - interval '14 hours',t0 - interval '16 minutes',e,e,0,0,'{"t_martian": 0.5}'),
           (s3,'day','2026-11-27',e,t0 - interval '38 hours',t0 - interval '31 minutes',e,e,0,0,'{"t_martian": 3}');
  insert into shifts (id,kind,date,opened_by,opened_at,locked_at,sent_at,pin_out_by,pin_in_by,cash_counted_cents,card_slip_cents)
    values (s4,'day','2026-11-26',e,t0 - interval '60 hours',t0 - interval '40 minutes',t0 - interval '39 minutes',e,e,0,0);
  insert into moves (id,shift_id,product_id,qty,kind,status,reason,by_staff,at) values
    (m1,s1,'t_martian',0.5,'out','pending','Given to boss',e,t0 - interval '1 minute'),
    (m2,s1,'t_martian',1,'out','pending','Sample',e,t0 - interval '6 minutes');
  insert into moves (id,shift_id,product_id,qty,kind,status,reason,by_staff,at,decided_by,decided_at) values
    (m3,s1,'t_martian',0.5,'out','approved','Given to boss',e,t0 - interval '3 minutes',m,t0 - interval '1 minute');

  create temp table r on commit drop as select * from public.claim_due_notifications(t0) where staff_id in (e, m, b);

  select count(*) into n from r where title = 'Stock out needs your OK' and staff_id = b;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' new-outs-to-boss=' || n; end if;
  select count(*) into n from r where title = 'Stock out needs your OK' and staff_id <> b;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' new-outs-to-others=' || n; end if;
  select count(*) into n from r where title like 'Still waiting%' and tag = 'out-' || m2;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' escalate-6min=' || n; end if;
  select count(*) into n from r where title like 'Still waiting%' and tag = 'out-' || m1;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' escalate-1min=' || n; end if;
  select count(*) into n from r where title = 'Stock out approved' and staff_id = e and body like '%by T Man%';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || ' decided=' || n; end if;
  select count(*) into n from r where title = 'Send the shift report' and staff_id = e;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' remind=' || n; end if;
  select count(*) into n from r where title = 'Shift report not sent' and tag = 'report-' || s3;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' alert-31min=' || n; end if;
  select count(*) into n from r where tag = 'report-' || s4;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' sent-report-buzzed=' || n; end if;
  select count(*) into n from r where body = '0.5 g Martian F (R75) · T Emp · Given to boss';
  if n >= 1 then passed := passed + 1; else failed := failed + 1; report := report || ' text=' || (select string_agg(body, ' | ') from r); end if;

  select count(*) into n from r where title = 'Low stock' and tag = 'low-' || s2 and body = 'Day shift 28 Nov closed with: Martian F 0.5 g';
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' low-stock=' || n || ' ' || coalesce((select string_agg(body, ' | ') from r where title = 'Low stock'), ''); end if;
  select count(*) into n from r where title = 'Low stock' and tag = 'low-' || s3;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' low-stock-not-low=' || n; end if;
  select count(*) into n from public.claim_due_notifications(t0) where staff_id in (e, m, b);
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' second-call=' || n; end if;
  select count(*) into n from public.claim_due_notifications(t0 + interval '5 minutes') where staff_id in (e, m, b) and title like 'Still waiting%';
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || ' escalate-later=' || n; end if;
  select count(*) into n from public.claim_due_notifications(t0 + interval '5 minutes') where staff_id in (e, m, b);
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || ' third-call=' || n; end if;

  raise exception 'ALERT TESTS: % passed, % failed.%', passed, failed, report;
end $$;
