-- Most of an item that may be on display (the edibles jar holds 50). The app warns at stock in and at the count.
alter table public.products add column if not exists max_qty numeric;
