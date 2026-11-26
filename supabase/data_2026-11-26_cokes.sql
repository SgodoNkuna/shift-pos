-- 26 Nov night, Wisani: the night started with 4 Coke and 3 were sold. Night opening 2 -> 4 (recorded as a correction), 3 Coke sales (cash, R20).
-- The locked Day shift still says Coke close 2; only the boss can correct a locked shift (it should be 4, as on the paper sheet).
begin;
update public.shifts set opening = jsonb_set(opening, '{coke}', '4'),
  opening_changes = coalesce(opening_changes, '{}'::jsonb) || '{"coke":{"from":2,"to":4,"by":"89111696-729c-4935-ac72-4045b1cf0b78"}}'::jsonb
where id = '65127de2-9623-418e-af1c-984039166588' and locked_at is null;
insert into public.sales (id, shift_id, at, by_staff, lines, payments)
select gen_random_uuid(), '65127de2-9623-418e-af1c-984039166588', now(), '89111696-729c-4935-ac72-4045b1cf0b78',
  '[{"qty":1,"productId":"coke","unitCents":2000}]', '[{"cents":2000,"method":"cash"}]' from generate_series(1, 3);
insert into public.audit (by_staff, action, ref, detail) values ('89111696-729c-4935-ac72-4045b1cf0b78', 'owner_fix', '65127de2-9623-418e-af1c-984039166588',
  '{"what":"Night opening Coke 2 -> 4; 3 Coke sold at night recorded as cash R20 each"}');
commit;
