-- 26 Nov night: the edibles jar holds 50 Gummies; 1 Water sold by Wisani on the night shift (cash, R15).
update public.products set max_qty = 50 where id = 'gummies';
insert into public.sales (id, shift_id, at, by_staff, lines, payments)
values (gen_random_uuid(), '65127de2-9623-418e-af1c-984039166588', now(), '89111696-729c-4935-ac72-4045b1cf0b78',
  '[{"qty":1,"productId":"water","unitCents":1500}]', '[{"cents":1500,"method":"cash"}]');
