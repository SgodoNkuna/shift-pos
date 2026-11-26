-- 26 Nov: hubbly items, duplicate Sprite/Powerade sales undone (owner: 4 Sprite and 3 Powerade are really there), R100 hubbly hire recorded.
insert into public.products (id, name, category_id, unit, step, low_at, price_cents, active, sort, track) values
  ('hubbly', 'Hubbly hire', 'hubbly', 'ea', 1, 0, 10000, true, 100, false),
  ('hubblyrefill', 'Hubbly refill', 'hubbly', 'ea', 1, 0, 5000, true, 101, false)
on conflict (id) do update set name = excluded.name, price_cents = excluded.price_cents, track = false, active = true;
insert into public.prices (product_id, cents) values ('hubbly', 10000), ('hubblyrefill', 5000);

update public.sales set void = jsonb_build_object('by', by_staff, 'reason', 'Rung up twice (also on Lerato''s phone). Fixed 26 Nov at owner''s request', 'at', now())
where id in ('d5d0453c-4730-4aec-8274-75152acdf71f', 'e23213e7-9e6b-4543-9754-dee2487cea73', 'cfe144d1-6d6a-4e13-aeba-56c391835250')
  and (void is null or void = 'null'::jsonb);

insert into public.sales (id, shift_id, at, by_staff, lines, payments)
select gen_random_uuid(), '33fa4d29-c2b0-4092-a7a4-106ef4e3d330', now(), s.id,
  '[{"qty":1,"productId":"hubbly","unitCents":10000}]', '[{"cents":10000,"method":"cash"}]'
from public.staff s where s.name like 'Wisani%';

insert into public.audit (by_staff, action, ref, detail)
select s.id, 'owner_fix', '33fa4d29-c2b0-4092-a7a4-106ef4e3d330',
  '{"what":"Undid 2 Sprite + 1 Powerade rung up twice; added R100 hubbly hire (cash) sold earlier"}'::jsonb
from public.staff s where s.name like 'Wisani%';
