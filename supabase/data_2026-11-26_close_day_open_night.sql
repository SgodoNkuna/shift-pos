-- 26 Nov evening, done for Wisani at his request: lock the Day shift with the paper sheet's close counts, cash and card total,
-- add Lerato's R100 transport, start Wisani's Night shift (R80 float), and ask Ta Vuyo to approve 1 g Martian F given to him.
-- Sales not rung up on the app show as stock differences on the Day report until they are sorted out. Cones: 20 in - 2 sold = 18.
begin;
insert into public.expenses (id, shift_id, cents, note, by_staff, at)
values (gen_random_uuid(), '33fa4d29-c2b0-4092-a7a4-106ef4e3d330', 10000, 'Lerato transport home', 'cb39a1de-75b4-45a3-8868-b4913c77fd4a', now());

update public.shifts set
  counts = '{"outdoor":28,"supercheese":28,"castro":8,"exodus":6,"icecream":4,"pinkink":2,"icecool":5,"cadillac":3,"martian":3,"grapeballs":7,"gummies":51,"kings":2,
             "coke":2,"sprite":4,"stoney":6,"monster":5,"powerade":3,"water":6,
             "lighter":14,"bluestar":14,"bobmarley":4,"limitless":50,"rizla30":50,"rizla20":13,"bejo":12,"raw":12,"honeyp":2,"cones":18}'::jsonb,
  cash_counted_cents = 23000, card_slip_cents = 162400,
  pin_out_by = 'cb39a1de-75b4-45a3-8868-b4913c77fd4a', pin_in_by = '89111696-729c-4935-ac72-4045b1cf0b78',
  locked_at = now(), sent_at = now()
where id = '33fa4d29-c2b0-4092-a7a4-106ef4e3d330' and locked_at is null;

insert into public.shifts (id, kind, date, opened_by, opened_at, opening, float_cents)
select gen_random_uuid(), 'night', '2026-11-26', '89111696-729c-4935-ac72-4045b1cf0b78', now(), counts, 8000
from public.shifts where id = '33fa4d29-c2b0-4092-a7a4-106ef4e3d330';

insert into public.moves (id, shift_id, product_id, qty, kind, status, reason, by_staff, at)
select gen_random_uuid(), id, 'martian', 1, 'out', 'pending', 'Given to boss', '89111696-729c-4935-ac72-4045b1cf0b78', now()
from public.shifts where kind = 'night' and date = '2026-11-26' and locked_at is null;

insert into public.audit (by_staff, action, ref, detail) values ('89111696-729c-4935-ac72-4045b1cf0b78', 'owner_fix', '33fa4d29-c2b0-4092-a7a4-106ef4e3d330',
  '{"what":"Day shift locked from the paper sheet (counts, R230 cash, R1,624 card slip); R100 Lerato transport added; report sent on WhatsApp as a paper copy. Night shift opened for Wisani, R80 float. 1 g Martian F to Ta Vuyo sent for approval."}');
commit;
