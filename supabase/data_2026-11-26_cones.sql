-- 26 Nov: Cones added to Rolling material at R2 each. Stock starts at 0: log the real number with Stock in.
insert into public.products (id, name, category_id, unit, step, low_at, price_cents, active, sort, track)
values ('cones', 'Cones', 'rolling', 'ea', 1, 10, 200, true, 28, true)
on conflict (id) do update set name = excluded.name, category_id = excluded.category_id, price_cents = excluded.price_cents, active = true;
insert into public.prices (product_id, cents) values ('cones', 200);
