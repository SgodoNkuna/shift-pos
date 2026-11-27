-- 27 Nov night, at Wisani's request: start Simphiwe's Night shift. Opening = the Day close in the app, with the paper sheet's
-- Outdoor 27 (app 14) and Super Cheese 0 (app 2) recorded as opening corrections. Cones kept at the app's 40. Float R795 (cash on hand per the sheet).
begin;
insert into public.shifts (id, kind, date, opened_by, opened_at, opening, float_cents, opening_changes)
select gen_random_uuid(), 'night', '2026-11-27', 'b7f6c2fb-11ee-4966-adc0-dd80e6f65c56', now(),
  counts || '{"outdoor":27,"supercheese":0}'::jsonb, 79500,
  '{"outdoor":{"from":14,"to":27,"by":"89111696-729c-4935-ac72-4045b1cf0b78"},"supercheese":{"from":2,"to":0,"by":"89111696-729c-4935-ac72-4045b1cf0b78"}}'::jsonb
from public.shifts where id = '7173f7a5-3cdd-4d3e-8e28-c9b32b27979f'
  and not exists (select 1 from public.shifts where locked_at is null);
insert into public.audit (by_staff, action, ref, detail) values ('89111696-729c-4935-ac72-4045b1cf0b78', 'owner_fix', '7173f7a5-3cdd-4d3e-8e28-c9b32b27979f',
  '{"what":"Night shift 27 Nov started for Simphiwe: Outdoor 14 -> 27 and Super Cheese 2 -> 0 from the paper sheet, float R795"}');
commit;
