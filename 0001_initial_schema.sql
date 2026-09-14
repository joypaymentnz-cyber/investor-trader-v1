create extension if not exists pgcrypto;

create type public.app_role as enum ('INVESTOR','TRADER');
create type public.currency_code as enum ('NGN','USDT');
create type public.term_days as enum ('3','7');
create type public.confirmation_status as enum ('PENDING','CONFIRMED','DISPUTED');
create type public.payment_status as enum ('NOT_PAID','PARTIALLY_PAID','PAID','OVERDUE');
create type public.payment_confirmation_status as enum ('PENDING_RECEIPT','CONFIRMED','DISPUTED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  normalized_name text generated always as (lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique default ('TL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  investor_id uuid not null references public.profiles(id),
  trader_id uuid references public.profiles(id),
  investor_name text not null,
  trader_name text not null,
  trader_normalized_name text not null,
  currency public.currency_code not null,
  amount_invested numeric(30,8) not null check (amount_invested > 0),
  roi_percent numeric(7,4) not null check (roi_percent >= 0 and roi_percent <= 10000),
  expected_profit numeric(30,8) generated always as (amount_invested * roi_percent / 100) stored,
  expected_payout numeric(30,8) generated always as (amount_invested + (amount_invested * roi_percent / 100)) stored,
  investment_date date not null,
  investment_day_of_week text not null,
  term term_days not null,
  expected_payout_date date not null,
  payout_day_of_week text not null,
  confirmation_status public.confirmation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  amount numeric(30,8) not null check (amount > 0),
  payment_date date not null default current_date,
  confirmation_status public.payment_confirmation_status not null default 'PENDING_RECEIPT',
  recorded_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.transaction_events (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index transactions_investor_idx on public.transactions(investor_id);
create index transactions_trader_idx on public.transactions(trader_id);
create index transactions_trader_name_idx on public.transactions(trader_normalized_name);
create index payments_transaction_idx on public.payments(transaction_id);
create index notifications_user_idx on public.notifications(user_id, read_at);

create or replace function public.day_name(d date) returns text
language sql immutable as $$ select to_char(d, 'FMDay'); $$;

create or replace function public.add_business_days(start_date date, days integer)
returns date language plpgsql immutable as $$
declare d date := start_date; remaining integer := days;
begin
  while remaining > 0 loop
    d := d + 1;
    if extract(isodow from d) between 1 and 5 then remaining := remaining - 1; end if;
  end loop;
  return d;
end $$;

create or replace function public.refresh_transaction_dates()
returns trigger language plpgsql as $$
declare n integer;
begin
  n := case when NEW.term = '3' then 3 else 7 end;
  NEW.investment_day_of_week := public.day_name(NEW.investment_date);
  NEW.expected_payout_date := public.add_business_days(NEW.investment_date, n);
  NEW.payout_day_of_week := public.day_name(NEW.expected_payout_date);
  NEW.updated_at := now();
  return NEW;
end $$;

create trigger transactions_dates_before_write
before insert or update of investment_date, term on public.transactions
for each row execute function public.refresh_transaction_dates();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'INVESTOR'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.payment_status_for(t public.transactions)
returns public.payment_status language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce((select sum(p.amount) from public.payments p where p.transaction_id=t.id and p.confirmation_status='CONFIRMED'),0) >= t.expected_payout then 'PAID'::public.payment_status
    when coalesce((select sum(p.amount) from public.payments p where p.transaction_id=t.id and p.confirmation_status='CONFIRMED'),0) > 0 then
      case when current_date > t.expected_payout_date then 'OVERDUE'::public.payment_status else 'PARTIALLY_PAID'::public.payment_status end
    when current_date > t.expected_payout_date then 'OVERDUE'::public.payment_status
    else 'NOT_PAID'::public.payment_status
  end
$$;

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.payments enable row level security;
alter table public.transaction_events enable row level security;
alter table public.notifications enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select on public.transaction_events to authenticated;
grant select, update on public.notifications to authenticated;

create policy "profile own row" on public.profiles for select to authenticated using (id=auth.uid());
create policy "profile own update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "investor sees own transactions" on public.transactions for select to authenticated
using (investor_id=auth.uid() or trader_id=auth.uid() or (trader_id is null and trader_normalized_name=(select normalized_name from public.profiles where id=auth.uid() and role='TRADER')));

create policy "investor creates transactions" on public.transactions for insert to authenticated
with check (investor_id=auth.uid() and (select role from public.profiles where id=auth.uid())='INVESTOR');

create policy "transaction parties update" on public.transactions for update to authenticated
using (investor_id=auth.uid() or trader_id=auth.uid())
with check (investor_id=auth.uid() or trader_id=auth.uid());

create policy "payment parties read" on public.payments for select to authenticated
using (exists(select 1 from public.transactions t where t.id=transaction_id and (t.investor_id=auth.uid() or t.trader_id=auth.uid())));

create policy "trader records payments" on public.payments for insert to authenticated
with check (recorded_by=auth.uid() and exists(select 1 from public.transactions t where t.id=transaction_id and t.trader_id=auth.uid()));

create policy "investor confirms payments" on public.payments for update to authenticated
using (exists(select 1 from public.transactions t where t.id=transaction_id and t.investor_id=auth.uid()))
with check (exists(select 1 from public.transactions t where t.id=transaction_id and t.investor_id=auth.uid()));

create policy "party sees events" on public.transaction_events for select to authenticated
using (exists(select 1 from public.transactions t where t.id=transaction_id and (t.investor_id=auth.uid() or t.trader_id=auth.uid())));

create policy "own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "own notifications update" on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
