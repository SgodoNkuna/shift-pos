-- Shift POS: tables, roles and row-level security.
-- Money is integer cents. Quantities are numeric(10,1). Spec §6 is the permission source of truth.

-- ---------- Staff and roles ----------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  phone text,
  role text not null check (role in ('employee','manager','boss')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.my_staff_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from staff where user_id = auth.uid() and active $$;

create function public.my_role() returns text language sql stable security definer set search_path = public as
$$ select role from staff where user_id = auth.uid() and active $$;

create function public.is_lead() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_role() in ('manager','boss'), false) $$;

create function public.is_boss() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(my_role() = 'boss', false) $$;

create table public.invites (
  token text primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  created_by uuid not null references staff(id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);

-- ---------- Products, prices, costs ----------
create table public.products (
  id text primary key,
  name text not null,
  category_id text not null,
  unit text not null check (unit in ('ea','g')),
  step numeric(4,1) not null check (step > 0),
  low_at numeric(10,1) not null default 3,
  price_cents integer not null check (price_cents >= 0),
  active boolean not null default true
);

-- Price history: rows are only ever added, never changed.
create table public.prices (
  id bigint generated always as identity primary key,
  product_id text not null references products(id),
  cents integer not null check (cents >= 0),
  effective_from timestamptz not null default now(),
  set_by uuid references staff(id)
);

-- Boss-only.
create table public.product_costs (
  product_id text primary key references products(id),
  cents integer not null check (cents >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Shifts and what happens in them ----------
create table public.shifts (
  id uuid primary key,
  kind text not null check (kind in ('day','night')),
  date date not null,
  opened_by uuid not null references staff(id),
  opened_at timestamptz not null,
  opening jsonb not null default '{}',
  float_cents integer not null default 0,
  counts jsonb not null default '{}',
  cash_counted_cents integer,
  card_slip_cents integer,
  pin_out_by uuid references staff(id),
  pin_in_by uuid references staff(id),
  locked_at timestamptz,
  sent_at timestamptz
);
create index on public.shifts (locked_at);

create table public.sales (
  id uuid primary key,
  shift_id uuid not null references shifts(id),
  at timestamptz not null,
  by_staff uuid not null references staff(id),
  lines jsonb not null,
  payments jsonb not null,
  void jsonb
);
create index on public.sales (shift_id);

create table public.moves (
  id uuid primary key,
  shift_id uuid not null references shifts(id),
  product_id text not null references products(id),
  qty numeric(10,1) not null check (qty > 0),
  kind text not null check (kind in ('in','out')),
  status text not null check (status in ('done','pending','approved','rejected')),
  reason text,
  by_staff uuid not null references staff(id),
  at timestamptz not null,
  decided_by uuid references staff(id),
  decided_at timestamptz,
  escalated_at timestamptz
);
create index on public.moves (shift_id);
create index on public.moves (status) where status = 'pending';

create table public.expenses (
  id uuid primary key,
  shift_id uuid not null references shifts(id),
  cents integer not null check (cents > 0),
  note text not null,
  by_staff uuid not null references staff(id),
  at timestamptz not null
);
create index on public.expenses (shift_id);

create table public.settings (key text primary key, value jsonb not null);
insert into public.settings values
  ('stock_out_reasons', '["Given to boss","Sample","Damaged","Other"]'),
  ('escalate_after_min', '5'),
  ('remind_sender_after_min', '15'),
  ('alert_leads_after_min', '30'),
  ('multi_seller', 'false');

create table public.audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_staff uuid references staff(id),
  action text not null,
  ref text,
  detail jsonb
);

-- ---------- Helpers used by policies ----------
create function public.shift_visible(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select is_lead() or exists (
    select 1 from shifts where id = s and (opened_by = my_staff_id() or pin_in_by = my_staff_id()))
  or s = (select id from shifts where locked_at is not null order by locked_at desc limit 1)
$$;

create function public.shift_writable(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shifts where id = s and locked_at is null and (opened_by = my_staff_id() or is_lead()))
$$;

-- ---------- Guards no policy can express ----------
-- A locked shift: only the boss may change it; anyone who can see it may set sent_at once.
create function public.guard_shift_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.locked_at is not null and not is_boss() then
    if (to_jsonb(new) - 'sent_at') is distinct from (to_jsonb(old) - 'sent_at') then
      raise exception 'This shift is locked';
    end if;
  end if;
  if new.locked_at is not null and old.locked_at is null and exists
     (select 1 from moves where shift_id = new.id and status = 'pending') then
    raise exception 'Cannot lock: a stock out is waiting for approval';
  end if;
  if new.locked_at is not null and old.locked_at is null and
     (new.cash_counted_cents is null or new.card_slip_cents is null or new.pin_out_by is null or new.pin_in_by is null) then
    raise exception 'Cannot lock: cash count, card slip and both PINs are needed';
  end if;
  return new;
end $$;
create trigger shifts_guard before update on public.shifts for each row execute function guard_shift_update();

-- Only managers and the boss may approve or reject stock out; nobody may edit other fields of a move.
create function public.guard_move_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - array['status','decided_by','decided_at','escalated_at']) is distinct from
     (to_jsonb(old) - array['status','decided_by','decided_at','escalated_at']) then
    raise exception 'Stock moves cannot be edited';
  end if;
  if new.status is distinct from old.status then
    if not is_lead() then raise exception 'Only a manager or the boss can approve stock out'; end if;
    if old.status <> 'pending' or new.status not in ('approved','rejected') then raise exception 'Already decided'; end if;
  end if;
  return new;
end $$;
create trigger moves_guard before update on public.moves for each row execute function guard_move_update();

-- A sale can only be changed by voiding it.
create function public.guard_sale_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(new) - 'void') is distinct from (to_jsonb(old) - 'void') or old.void is not null then
    raise exception 'Sales cannot be edited, only voided once';
  end if;
  return new;
end $$;
create trigger sales_guard before update on public.sales for each row execute function guard_sale_update();

-- ---------- Row-level security ----------
alter table public.staff enable row level security;
alter table public.invites enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.product_costs enable row level security;
alter table public.shifts enable row level security;
alter table public.sales enable row level security;
alter table public.moves enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;
alter table public.audit enable row level security;

create policy staff_read on public.staff for select to authenticated using (my_staff_id() is not null);
create policy staff_write on public.staff for all to authenticated using (is_lead()) with check (is_lead() and (role <> 'boss' or is_boss()));

create policy invites_lead on public.invites for all to authenticated using (is_lead()) with check (is_lead());

create policy products_read on public.products for select to authenticated using (my_staff_id() is not null);
create policy products_write on public.products for all to authenticated using (is_lead()) with check (is_lead());

create policy prices_read on public.prices for select to authenticated using (my_staff_id() is not null);
create policy prices_add on public.prices for insert to authenticated with check (is_lead());

create policy costs_boss on public.product_costs for all to authenticated using (is_boss()) with check (is_boss());

create policy shifts_read on public.shifts for select to authenticated using (shift_visible(id));
create policy shifts_open on public.shifts for insert to authenticated with check (opened_by = my_staff_id() and locked_at is null);
create policy shifts_update on public.shifts for update to authenticated
  using (is_boss() or opened_by = my_staff_id() or pin_in_by = my_staff_id() or is_lead())
  with check (is_boss() or opened_by = my_staff_id() or pin_in_by = my_staff_id() or is_lead());

create policy sales_read on public.sales for select to authenticated using (shift_visible(shift_id));
create policy sales_add on public.sales for insert to authenticated with check (by_staff = my_staff_id() and shift_writable(shift_id));
create policy sales_void on public.sales for update to authenticated using (shift_writable(shift_id)) with check (shift_writable(shift_id));

create policy moves_read on public.moves for select to authenticated using (shift_visible(shift_id) or is_lead());
create policy moves_add on public.moves for insert to authenticated
  with check (by_staff = my_staff_id() and shift_writable(shift_id) and status = case when kind = 'in' then 'done' else 'pending' end);
create policy moves_decide on public.moves for update to authenticated using (is_lead()) with check (is_lead());

create policy expenses_read on public.expenses for select to authenticated using (shift_visible(shift_id));
create policy expenses_add on public.expenses for insert to authenticated with check (by_staff = my_staff_id() and shift_writable(shift_id));

create policy settings_read on public.settings for select to authenticated using (my_staff_id() is not null);
create policy settings_boss on public.settings for all to authenticated using (is_boss()) with check (is_boss());

create policy audit_add on public.audit for insert to authenticated with check (by_staff = my_staff_id());
create policy audit_read on public.audit for select to authenticated using (is_lead());

-- Live updates for approvals and the boss's live view.
alter publication supabase_realtime add table public.moves, public.sales, public.shifts, public.expenses;
