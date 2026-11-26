-- 26 Nov night, Wisani: the night opened with 7 Water (not 6); 1 sold, 6 left.
begin;
update public.shifts set opening = jsonb_set(opening, '{water}', '7'),
  opening_changes = coalesce(opening_changes, '{}'::jsonb) || '{"water":{"from":6,"to":7,"by":"89111696-729c-4935-ac72-4045b1cf0b78"}}'::jsonb
where id = '65127de2-9623-418e-af1c-984039166588' and locked_at is null;
insert into public.audit (by_staff, action, ref, detail) values ('89111696-729c-4935-ac72-4045b1cf0b78', 'owner_fix', '65127de2-9623-418e-af1c-984039166588', '{"what":"Night opening Water 6 -> 7"}');
commit;
