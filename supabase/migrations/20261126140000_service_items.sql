-- Services like hubbly hire: sold on the till, no stock to count.
alter table public.products add column if not exists track boolean not null default true;
