-- Role tests. Everything runs in one block that always ends by raising,
-- so the whole thing rolls back and leaves no data. The message is the report.
do $$
declare
  e uuid := gen_random_uuid(); e2 uuid := gen_random_uuid(); m uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  se uuid; se2 uuid; sm uuid; sb uuid;
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); mv uuid := gen_random_uuid(); mv2 uuid := gen_random_uuid(); mv3 uuid := gen_random_uuid();
  report text := ''; passed int := 0; failed int := 0;
  n bigint; ok boolean;
  c record;
begin
  insert into auth.users (id, email, aud, role) values
    (e,'e@test.local','authenticated','authenticated'),(e2,'e2@test.local','authenticated','authenticated'),
    (m,'m@test.local','authenticated','authenticated'),(b,'b@test.local','authenticated','authenticated');
  insert into public.staff (user_id,name,role) values (e,'Employee A','employee') returning id into se;
  insert into public.staff (user_id,name,role) values (e2,'Employee B','employee') returning id into se2;
  insert into public.staff (user_id,name,role) values (m,'Manager','manager') returning id into sm;
  insert into public.staff (user_id,name,role) values (b,'Boss','boss') returning id into sb;
  -- Real open shifts may exist; let these tests open their own.
  update settings set value = 'true' where key = 'multi_seller';
  insert into products values ('t_supercheese','Super Cheese','main','ea',1,3,3000,true);
  insert into product_costs (product_id,cents) values ('t_supercheese',1400);
  insert into shifts (id,kind,date,opened_by,opened_at,opening,float_cents) values (s1,'night','2026-11-28',se,now(),'{"t_supercheese":25}',20000);
  insert into moves (id,shift_id,product_id,qty,kind,status,reason,by_staff,at) values (mv,s1,'t_supercheese',1,'out','pending','Given to boss',se,now());
  insert into shifts (id,kind,date,opened_by,opened_at,opening,float_cents) values (s2,'day','2026-11-29',se,now(),'{}',0);
  insert into moves (id,shift_id,product_id,qty,kind,status,reason,by_staff,at) values
    (mv2,s2,'t_supercheese',1,'out','pending','Sample',se,now()), (mv3,s2,'t_supercheese',1,'out','pending','Sample',se,now());
  insert into private.staff_pins (staff_id,pin_hash) values
    (sm, extensions.crypt('2222', extensions.gen_salt('bf',8))), (se2, extensions.crypt('3333', extensions.gen_salt('bf',8)));

  for c in select * from (values
    -- label, as user, sql, expect: 'ok' | 'deny' | 'n=<count>'
    (1,'employee cannot see cost prices', 'e', 'select count(*) from product_costs', 'n=0'),
    (2,'manager cannot see cost prices', 'm', 'select count(*) from product_costs', 'n=0'),
    (3,'boss can see cost prices', 'b', 'select count(*) from product_costs', 'n=1'),
    (4,'employee cannot add a price', 'e', $q$insert into prices (product_id,cents) values ('t_supercheese',3500)$q$, 'deny'),
    (5,'manager can add a price', 'm', $q$insert into prices (product_id,cents) values ('t_supercheese',3500)$q$, 'ok'),
    (6,'employee cannot change a product price', 'e', $q$update products set price_cents=1 where id='t_supercheese'$q$, 'deny'),
    (7,'employee can sell on own shift', 'e', format($q$insert into sales values (gen_random_uuid(),%L,now(),%L,'[{"productId":"t_supercheese","qty":1,"unitCents":3000}]','[{"method":"cash","cents":3000}]',null)$q$, s1, se), 'ok'),
    (8,'employee cannot sell as someone else', 'e', format($q$insert into sales values (gen_random_uuid(),%L,now(),%L,'[]','[]',null)$q$, s1, sm), 'deny'),
    (9,'other employee cannot see an open shift''s sales', 'e2', 'select count(*) from sales', 'n=0'),
    (10,'employee cannot approve stock out', 'e', format($q$update moves set status='approved' where id=%L$q$, mv), 'deny'),
    (11,'employee cannot add an already-approved stock out', 'e', format($q$insert into moves (id,shift_id,product_id,qty,kind,status,by_staff,at) values (gen_random_uuid(),%L,'t_supercheese',1,'out','approved',%L,now())$q$, s1, se), 'deny'),
    (12,'cannot lock while stock out is pending', 'e', format($q$update shifts set cash_counted_cents=23000, card_slip_cents=0, pin_out_by=%L, pin_in_by=%L, locked_at=now() where id=%L$q$, se, se2, s1), 'deny'),
    (13,'manager can approve stock out', 'm', format($q$update moves set status='approved', decided_by=%L, decided_at=now() where id=%L$q$, sm, mv), 'ok'),
    (14,'approved stock out cannot be changed again', 'b', format($q$update moves set status='rejected' where id=%L$q$, mv), 'deny'),
    (15,'cannot lock without cash count and PINs', 'e', format($q$update shifts set locked_at=now() where id=%L$q$, s1), 'deny'),
    (16,'employee can lock own shift when complete', 'e', format($q$update shifts set cash_counted_cents=23000, card_slip_cents=0, pin_out_by=%L, pin_in_by=%L, locked_at=now() where id=%L$q$, se, se2, s1), 'ok'),
    (17,'employee cannot change a locked shift', 'e', format($q$update shifts set counts='{"t_supercheese":99}' where id=%L$q$, s1), 'deny'),
    (18,'employee can mark a locked shift as sent', 'e', format($q$update shifts set sent_at=now() where id=%L$q$, s1), 'ok'),
    (19,'no expenses on a locked shift', 'e', format($q$insert into expenses values (gen_random_uuid(),%L,2000,'Late',%L,now())$q$, s1, se), 'deny'),
    (20,'incoming employee can read the last locked shift', 'e2', 'select count(*) from shifts', 'n=1'),
    (21,'manager cannot change a locked shift', 'm', format($q$update shifts set counts='{"t_supercheese":1}' where id=%L$q$, s1), 'deny'),
    (22,'boss can correct a locked shift', 'b', format($q$update shifts set counts='{"t_supercheese":23}' where id=%L$q$, s1), 'ok'),
    (23,'sales cannot be edited, only voided', 'e', 'update sales set payments=''[]''', 'deny'),
    (24,'manager cannot create a boss', 'm', $q$insert into staff (name,role) values ('X','boss')$q$, 'deny'),
    (25,'manager can add an employee', 'm', $q$insert into staff (name,role) values ('New','employee')$q$, 'ok'),
    (26,'employee cannot add staff', 'e', $q$insert into staff (name,role) values ('Y','employee')$q$, 'deny'),
    (27,'employee cannot read the audit log', 'e', 'select count(*) from audit', 'n=0'),
    (28,'employee cannot change settings', 'e', $q$update settings set value='true' where key='multi_seller'$q$, 'deny'),
    (29,'boss can change settings', 'b', $q$update settings set value='true' where key='multi_seller'$q$, 'ok'),
    (30,'employee can check the manager PIN', 'e', format($q$select (public.check_pin(%L,'2222')='ok')::int$q$, sm), 'n=1'),
    (31,'employee approves with the manager PIN', 'e', format($q$select (public.decide_out_with_pin(%L,%L,'2222',true)='ok')::int$q$, mv2, sm), 'n=1'),
    (32,'that approval is recorded as the manager', 'e', format($q$select count(*) from moves where id=%L and status='approved' and decided_by=%L$q$, mv2, sm), 'n=1'),
    (33,'a wrong lead PIN does not approve', 'e', format($q$select (public.decide_out_with_pin(%L,%L,'9999',true)='wrong')::int$q$, mv3, sm), 'n=1'),
    (34,'an employee PIN cannot approve', 'e', format($q$select (public.decide_out_with_pin(%L,%L,'3333',true)='not_lead')::int$q$, mv3, se2), 'n=1'),
    (35,'five wrong PINs lock it', 'e', format($q$select count(*) from (select public.check_pin(%L,'0000') r from generate_series(1,5)) x where r='locked'$q$, se2), 'n=1'),
    (36,'a locked PIN refuses the right PIN', 'e', format($q$select (public.check_pin(%L,'3333')='locked')::int$q$, se2), 'n=1'),
    (37,'employee cannot unlock a PIN', 'e', format($q$select public.reset_pin_lock(%L)$q$, se2), 'deny'),
    (38,'manager can unlock a PIN', 'm', format($q$select public.reset_pin_lock(%L)$q$, se2), 'ok'),
    (39,'unlocked PIN works again', 'e', format($q$select (public.check_pin(%L,'3333')='ok')::int$q$, se2), 'n=1'),
    (40,'nobody can read PIN hashes directly', 'b', 'select count(*) from private.staff_pins', 'deny'),
    (41,'employee still cannot approve directly', 'e', format($q$update moves set status='approved' where id=%L$q$, mv3), 'deny'),
    (42,'manager can change a product price', 'm', $q$update products set price_cents=3500 where id='t_supercheese'$q$, 'ok'),
    (43,'manager cannot set cost prices', 'm', $q$insert into product_costs (product_id,cents) values ('t_supercheese',1500) on conflict (product_id) do update set cents=excluded.cents$q$, 'deny'),
    (44,'boss can set cost prices', 'b', $q$insert into product_costs (product_id,cents) values ('t_supercheese',1500) on conflict (product_id) do update set cents=excluded.cents$q$, 'ok'),
    (45,'employee cannot change settings or float', 'e', $q$update settings set value='20000' where key='float_cents'$q$, 'deny'),
    (46,'boss switches several-sellers off', 'b', $q$update settings set value='false' where key='multi_seller'$q$, 'ok'),
    (47,'a second open shift is refused', 'e2', format($q$insert into shifts (id,kind,date,opened_by,opened_at) values (gen_random_uuid(),'day','2026-11-30',%L,now())$q$, se2), 'deny'),
    (48,'the clock-in screen is told whose shift is open', 'e2', $q$select count(*) from (select public.open_shift_owner() o) x where o is not null$q$, 'n=1'),
    (49,'a second employee joins the open shift', 'e2', $q$select count(*) from (select public.join_open_shift() j) x where j is not null$q$, 'n=1'),
    (50,'the helper can now sell into that shift', 'e2', format($q$insert into sales select gen_random_uuid(), j, now(), %L, '[]', '[]', null from (select public.join_open_shift() j) x$q$, se2), 'ok'),
    (51,'a normal shift update cannot remove the helper', 'e', $q$update shifts set helpers = '{}' where locked_at is null and opened_by = private.my_staff_id()$q$, 'ok'),
    (52,'the helper is still on the shift', 'e2', $q$select count(*) from shifts where locked_at is null and private.my_staff_id() = any(helpers)$q$, 'n=1')
  ) as t(no,label,who,sql,expect) order by no
  loop
    execute 'reset role';
    perform set_config('request.jwt.claims', json_build_object('sub', case c.who when 'e' then e when 'e2' then e2 when 'm' then m else b end, 'role','authenticated')::text, true);
    execute 'set local role authenticated';
    begin
      if c.expect like 'n=%' then
        execute c.sql into n;
        ok := n = substr(c.expect,3)::bigint;
      else
        execute c.sql; get diagnostics n = row_count;
        ok := (c.expect = 'ok') = (n > 0);
      end if;
    exception when others then
      ok := c.expect = 'deny';
    end;
    if ok then passed := passed + 1; else failed := failed + 1; report := report || ' FAIL#' || c.no || ' ' || c.label || ';'; end if;
  end loop;
  execute 'reset role';
  raise exception 'RLS TESTS: % passed, % failed.%', passed, failed, report;
end $$;
