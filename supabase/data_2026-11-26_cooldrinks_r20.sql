-- 26 Nov: owner confirmed Coke, Sprite and Stoney are R20 (R25 was overcharging). Monster and Powerade stay R25.
update public.products set price_cents = 2000 where id in ('coke', 'sprite', 'stoney');
insert into public.prices (product_id, cents) values ('coke', 2000), ('sprite', 2000), ('stoney', 2000);
