-- Load the 26 November sheets (products, prices, opening stock). Prices only get a history row when they change.
begin;
create temp table old_prices on commit drop as select id, price_cents from public.products;
insert into public.products (id,name,category_id,unit,step,low_at,price_cents,active,sort) values
('outdoor','Outdoor','main','ea',1,3,2000,true,1),
('supercheese','Super Cheese','main','ea',1,3,3000,true,2),
('castro','Castro Pop','main','ea',1,3,6000,true,3),
('exodus','Exodus Cheese','main','ea',1,3,8000,true,4),
('icecream','Ice Cream C','main','g',0.5,1,5000,true,5),
('pinkink','Pink Ink','main','g',0.5,1,10000,true,6),
('icecool','Ice Cold','main','g',0.5,1,12000,true,7),
('cadillac','Cadillac','main','g',0.5,1,12000,true,8),
('martian','Martian F','main','g',0.5,1,15000,true,9),
('grapeballs','Grape Balls','main','g',0.5,1,15000,true,10),
('gummies','Gummies','main','ea',1,3,3000,true,11),
('kings','Kings','main','ea',1,3,25000,true,12),
('coke','Coke','drinks','ea',1,3,2500,true,13),
('sprite','Sprite','drinks','ea',1,3,2500,true,14),
('stoney','Stoney','drinks','ea',1,3,2500,true,15),
('monster','Monster','drinks','ea',1,3,2500,true,16),
('powerade','Powerade','drinks','ea',1,3,2500,true,17),
('water','Water','drinks','ea',1,3,1500,true,18),
('lighter','Lighter','rolling','ea',1,3,2000,true,19),
('bluestar','Blue Star','rolling','ea',1,3,2000,true,20),
('bobmarley','Bob Marley','rolling','ea',1,3,3000,true,21),
('limitless','Limitless','rolling','ea',1,3,3000,true,22),
('rizla30','Rizla 1','rolling','ea',1,3,3000,true,23),
('rizla20','Rizla 2','rolling','ea',1,3,3000,true,24),
('bejo','Bejo','rolling','ea',1,3,3000,true,25),
('raw','Raw','rolling','ea',1,3,4000,true,26),
('honeyp','Honey P','rolling','ea',1,3,2000,true,27),
('eucalypto','Eucalypto','main','g',0.5,1,10000,false,99)
on conflict (id) do update set name = excluded.name, category_id = excluded.category_id, unit = excluded.unit, step = excluded.step,
  low_at = excluded.low_at, price_cents = excluded.price_cents, active = excluded.active, sort = excluded.sort;
insert into public.prices (product_id, cents)
select p.id, p.price_cents from public.products p left join old_prices o on o.id = p.id where o.id is null or o.price_cents <> p.price_cents;
update public.settings set value = '{"outdoor": 12, "supercheese": 14, "castro": 11, "exodus": 7, "icecream": 8, "pinkink": 2, "icecool": 5, "cadillac": 3, "martian": 4, "grapeballs": 7, "gummies": 0, "kings": 3, "coke": 5, "sprite": 6, "stoney": 6, "monster": 5, "powerade": 4, "water": 9, "lighter": 14, "bluestar": 14, "bobmarley": 4, "limitless": 50, "rizla30": 50, "rizla20": 13, "bejo": 12, "raw": 12, "honeyp": 2}'::jsonb where key = 'first_opening';
-- The empty test shift from 24 Nov (no sales, moves or expenses) would block the first real clock-in.
delete from public.shifts s where s.locked_at is null
  and not exists (select 1 from public.sales x where x.shift_id = s.id)
  and not exists (select 1 from public.moves x where x.shift_id = s.id)
  and not exists (select 1 from public.expenses x where x.shift_id = s.id);
commit;
select (select count(*) from public.products where active) active_products,
  (select string_agg(product_id || ' R' || cents/100, ', ' order by id) from public.prices where effective_from > now() - interval '1 minute') new_prices,
  (select count(*) from public.shifts) shifts, (select value->>'supercheese' from public.settings where key='first_opening') sc_opening;
