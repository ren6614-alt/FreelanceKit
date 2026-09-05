-- FreelanceKit schema for Supabase (Postgres)
-- Run in the SQL editor after creating a project.
-- This file is the source of truth for tables, RLS, and triggers.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  business_name text,
  email text,
  phone text,
  address text,
  website text,
  tax_id text,
  logo_path text,
  default_currency text not null default 'INR',
  default_terms text default 'Payment due within 15 days.',
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  quotation_prefix text not null default 'QT',
  next_quotation_number integer not null default 1,
  accent_color text default '#1F5C4D',
  invoice_template text not null default 'basic',
  invoice_footer text default 'Thank you for your business.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'free' check (status in ('free', 'pro', 'cancelled', 'past_due')),
  billing_period text check (billing_period in ('monthly', 'yearly')),
  provider text default 'none',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  tax_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  amount numeric(12,2) not null,
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  end_date date,
  next_run_date date not null,
  notes text,
  items jsonb not null default '[]'::jsonb,
  tax_rate numeric(6,2) not null default 0,
  discount numeric(12,2) not null default 0,
  active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'partially_paid', 'overdue')),
  currency text not null default 'INR',
  notes text,
  terms text,
  discount numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  template text not null default 'basic',
  recurring_schedule_id uuid references public.recurring_schedules (id) on delete set null,
  quotation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  rate numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  number text not null,
  issue_date date not null default current_date,
  expiry_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  currency text not null default 'INR',
  notes text,
  discount numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  converted_invoice_id uuid references public.invoices (id) on delete set null,
  template text not null default 'basic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

alter table public.invoices
  drop constraint if exists invoices_quotation_id_fkey;
alter table public.invoices
  add constraint invoices_quotation_id_fkey
  foreign key (quotation_id) references public.quotations (id) on delete set null;

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  rate numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at date not null default current_date,
  method text not null default 'other' check (method in ('bank_transfer', 'upi', 'cash', 'card', 'other')),
  reference text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'gateway')),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  category text not null default 'other' check (category in ('software', 'equipment', 'internet', 'travel', 'marketing', 'office', 'other')),
  incurred_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_issue_date_idx on public.invoices (user_id, issue_date);
create index if not exists quotations_user_id_idx on public.quotations (user_id);
create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists recurring_user_id_idx on public.recurring_schedules (user_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists quotations_updated_at on public.quotations;
create trigger quotations_updated_at before update on public.quotations
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New user bootstrap (profile + free subscription)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Effective plan: never derived from the browser
-- ---------------------------------------------------------------------------

create or replace function public.effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when s.plan = 'pro'
       and s.status in ('pro', 'cancelled')
       and (s.current_period_end is null or s.current_period_end > now())
      then 'pro'
      else 'free'
    end
    from public.subscriptions s
    where s.user_id = p_user
  ), 'free');
$$;

create or replace function public.my_plan()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.effective_plan(auth.uid());
$$;

grant execute on function public.my_plan() to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (user-owned rows cascade from auth.users)
-- ---------------------------------------------------------------------------

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Recurring invoice generation (call from a scheduled Edge Function)
-- Does not send email. Returns generated invoice ids.
-- ---------------------------------------------------------------------------

create or replace function public.generate_due_recurring_invoices()
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  new_id uuid;
  generated uuid[] := '{}';
  next_date date;
  inv_number text;
  next_num integer;
  prefix text;
  item jsonb;
  subtotal numeric;
  tax_total numeric;
  total numeric;
  amt numeric;
  line_tax numeric;
begin
  for rec in
    select * from public.recurring_schedules
    where active = true
      and next_run_date <= current_date
      and (end_date is null or next_run_date <= end_date)
      and public.effective_plan(user_id) = 'pro'
  loop
    subtotal := 0;
    tax_total := 0;

    select invoice_prefix, next_invoice_number
      into prefix, next_num
    from public.profiles
    where id = rec.user_id
    for update;

    inv_number := coalesce(prefix, 'INV') || '-' || lpad(next_num::text, 4, '0');

    if rec.items is not null and jsonb_array_length(rec.items) > 0 then
      for item in select * from jsonb_array_elements(rec.items)
      loop
        amt := coalesce((item->>'quantity')::numeric, 1) * coalesce((item->>'rate')::numeric, 0);
        line_tax := amt * coalesce((item->>'tax_rate')::numeric, rec.tax_rate) / 100.0;
        subtotal := subtotal + amt;
        tax_total := tax_total + line_tax;
      end loop;
    else
      subtotal := rec.amount;
      tax_total := rec.amount * rec.tax_rate / 100.0;
    end if;

    total := greatest(subtotal - coalesce(rec.discount, 0) + tax_total, 0);

    insert into public.invoices (
      user_id, client_id, number, issue_date, due_date, status, notes,
      discount, tax_rate, subtotal, tax_total, total, amount_paid,
      recurring_schedule_id
    ) values (
      rec.user_id, rec.client_id, inv_number, current_date, current_date + 15, 'sent', rec.notes,
      rec.discount, rec.tax_rate, subtotal, tax_total, total, 0, rec.id
    ) returning id into new_id;

    if rec.items is not null and jsonb_array_length(rec.items) > 0 then
      insert into public.invoice_items (user_id, invoice_id, description, quantity, rate, tax_rate, amount, sort_order)
      select
        rec.user_id,
        new_id,
        coalesce(item->>'description', 'Services'),
        coalesce((item->>'quantity')::numeric, 1),
        coalesce((item->>'rate')::numeric, 0),
        coalesce((item->>'tax_rate')::numeric, rec.tax_rate),
        coalesce((item->>'quantity')::numeric, 1) * coalesce((item->>'rate')::numeric, 0),
        ordinality::integer
      from jsonb_array_elements(rec.items) with ordinality as item;
    else
      insert into public.invoice_items (user_id, invoice_id, description, quantity, rate, tax_rate, amount, sort_order)
      values (rec.user_id, new_id, coalesce(rec.notes, 'Recurring invoice'), 1, rec.amount, rec.tax_rate, rec.amount, 0);
    end if;

    update public.profiles
      set next_invoice_number = next_num + 1
      where id = rec.user_id;

    next_date := case rec.frequency
      when 'weekly' then rec.next_run_date + 7
      when 'monthly' then rec.next_run_date + interval '1 month'
      when 'quarterly' then rec.next_run_date + interval '3 months'
      when 'yearly' then rec.next_run_date + interval '1 year'
    end;

    update public.recurring_schedules
      set next_run_date = next_date::date,
          last_generated_at = now(),
          active = case when end_date is not null and next_date::date > end_date then false else true end
      where id = rec.id;

    generated := array_append(generated, new_id);
  end loop;

  return generated;
end;
$$;

create or replace function public.generate_my_due_recurring_invoices()
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  new_id uuid;
  generated uuid[] := '{}';
  uid uuid := auth.uid();
  next_date date;
  inv_number text;
  next_num integer;
  prefix text;
  item jsonb;
  subtotal numeric;
  tax_total numeric;
  total numeric;
  amt numeric;
  line_tax numeric;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if public.effective_plan(uid) <> 'pro' then
    raise exception 'Pro plan required';
  end if;

  for rec in
    select * from public.recurring_schedules
    where user_id = uid
      and active = true
      and next_run_date <= current_date
      and (end_date is null or next_run_date <= end_date)
  loop
    subtotal := 0;
    tax_total := 0;

    select invoice_prefix, next_invoice_number
      into prefix, next_num
    from public.profiles
    where id = uid
    for update;

    inv_number := coalesce(prefix, 'INV') || '-' || lpad(next_num::text, 4, '0');

    if rec.items is not null and jsonb_array_length(rec.items) > 0 then
      for item in select * from jsonb_array_elements(rec.items)
      loop
        amt := coalesce((item->>'quantity')::numeric, 1) * coalesce((item->>'rate')::numeric, 0);
        line_tax := amt * coalesce((item->>'tax_rate')::numeric, rec.tax_rate) / 100.0;
        subtotal := subtotal + amt;
        tax_total := tax_total + line_tax;
      end loop;
    else
      subtotal := rec.amount;
      tax_total := rec.amount * rec.tax_rate / 100.0;
    end if;

    total := greatest(subtotal - coalesce(rec.discount, 0) + tax_total, 0);

    insert into public.invoices (
      user_id, client_id, number, issue_date, due_date, status, notes,
      discount, tax_rate, subtotal, tax_total, total, amount_paid,
      recurring_schedule_id
    ) values (
      rec.user_id, rec.client_id, inv_number, current_date, current_date + 15, 'sent', rec.notes,
      rec.discount, rec.tax_rate, subtotal, tax_total, total, 0, rec.id
    ) returning id into new_id;

    if rec.items is not null and jsonb_array_length(rec.items) > 0 then
      insert into public.invoice_items (user_id, invoice_id, description, quantity, rate, tax_rate, amount, sort_order)
      select
        rec.user_id,
        new_id,
        coalesce(el->>'description', 'Services'),
        coalesce((el->>'quantity')::numeric, 1),
        coalesce((el->>'rate')::numeric, 0),
        coalesce((el->>'tax_rate')::numeric, rec.tax_rate),
        coalesce((el->>'quantity')::numeric, 1) * coalesce((el->>'rate')::numeric, 0),
        ordinality::integer
      from jsonb_array_elements(rec.items) with ordinality as t(el, ordinality);
    else
      insert into public.invoice_items (user_id, invoice_id, description, quantity, rate, tax_rate, amount, sort_order)
      values (rec.user_id, new_id, coalesce(rec.notes, 'Recurring invoice'), 1, rec.amount, rec.tax_rate, rec.amount, 0);
    end if;

    update public.profiles set next_invoice_number = next_num + 1 where id = uid;

    next_date := (case rec.frequency
      when 'weekly' then rec.next_run_date + 7
      when 'monthly' then rec.next_run_date + interval '1 month'
      when 'quarterly' then rec.next_run_date + interval '3 months'
      when 'yearly' then rec.next_run_date + interval '1 year'
    end)::date;

    update public.recurring_schedules
      set next_run_date = next_date,
          last_generated_at = now(),
          active = case when end_date is not null and next_date > end_date then false else true end
      where id = rec.id;

    generated := array_append(generated, new_id);
  end loop;

  return generated;
end;
$$;

grant execute on function public.generate_my_due_recurring_invoices() to authenticated;
revoke execute on function public.generate_due_recurring_invoices() from public, anon, authenticated;
grant execute on function public.generate_due_recurring_invoices() to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_schedules enable row level security;

-- Profiles
create policy profiles_select on public.profiles for select using (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);

-- Subscriptions: read own row. Writes only via service role / security definer.
create policy subscriptions_select on public.subscriptions for select using (auth.uid() = user_id);

-- Generic owner policies
create policy clients_all on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoices_all on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoice_items_all on public.invoice_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy quotations_all on public.quotations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy quotation_items_all on public.quotation_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy payments_all on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy expenses_all on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_all on public.recurring_schedules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: logos (private per user folder)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

create policy logos_select on storage.objects for select
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy logos_insert on storage.objects for insert
  with check (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy logos_update on storage.objects for update
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy logos_delete on storage.objects for delete
  using (bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1]);
