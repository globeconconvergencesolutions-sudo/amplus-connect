-- Phone-first CRM customers (separate from staff auth profiles).
-- Links interest leads and invoices without requiring a login.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  phone_key text not null,
  email text,
  location text,
  notes text,
  user_id uuid unique references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_phone_key_uidx
  on public.customers (phone_key);

create unique index if not exists customers_email_lower_uidx
  on public.customers (lower(email))
  where email is not null and length(trim(email)) > 0;

create index if not exists customers_created_at_idx
  on public.customers (created_at desc);

create index if not exists customers_full_name_idx
  on public.customers (full_name);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

revoke all on table public.customers from public, anon;
grant select, insert, update, delete on table public.customers to authenticated;
grant all on table public.customers to service_role;

drop policy if exists "customers staff read" on public.customers;
create policy "customers staff read" on public.customers
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "customers staff write" on public.customers;
create policy "customers staff write" on public.customers
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Interest leads → customer
alter table public.interest_leads
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.interest_leads drop constraint if exists interest_leads_status_check;
alter table public.interest_leads
  add constraint interest_leads_status_check
  check (status in ('new', 'contacted', 'closed', 'converted'));

create index if not exists interest_leads_customer_id_idx
  on public.interest_leads (customer_id);

-- Invoices → customer + proforma/invoice kind
alter table public.invoices
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.invoices
  add column if not exists document_kind text not null default 'invoice';

alter table public.invoices drop constraint if exists invoices_document_kind_check;
alter table public.invoices
  add constraint invoices_document_kind_check
  check (document_kind in ('invoice', 'proforma'));

alter table public.invoices
  add column if not exists reference_text text;

create index if not exists invoices_customer_id_idx
  on public.invoices (customer_id);

notify pgrst, 'reload schema';
