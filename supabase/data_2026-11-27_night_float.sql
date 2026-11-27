-- 27 Nov night: Simphiwe's float is R55 (what is really in the drawer), not R795.
begin;
update public.shifts set float_cents = 5500 where kind = 'night' and date = '2026-11-27' and locked_at is null;
insert into public.audit (by_staff, action, ref, detail)
select '89111696-729c-4935-ac72-4045b1cf0b78', 'owner_fix', id, '{"what":"Night float R795 -> R55 (counted in the drawer)"}' from public.shifts where kind = 'night' and date = '2026-11-27';
commit;
