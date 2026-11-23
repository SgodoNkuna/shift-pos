-- Opening counts changed at clock in (shown as a flag on the report).
alter table public.shifts add column if not exists opening_changes jsonb;
