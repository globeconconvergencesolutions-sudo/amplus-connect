-- Sales invoices: staff-created tax-style invoices with line items and PDF export.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'void')),
  issue_date date not null default (timezone('Africa/Nairobi', now()))::date,
  due_date date,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_pin text,
  customer_address text,
  customer_lpo text,
  order_id uuid references public.orders(id) on delete set null,
  currency text not null default 'KES',
  subtotal_kes numeric(14,2) not null default 0,
  tax_rate_percent numeric(6,3) not null default 0,
  tax_kes numeric(14,2) not null default 0,
  total_kes numeric(14,2) not null default 0,
  notes text,
  remarks text,
  delivery_meta text,
  payment_terms text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit text not null default 'pc',
  unit_price_kes numeric(14,2) not null default 0,
  line_total_kes numeric(14,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoices_status_issue_idx
  on public.invoices (status, issue_date desc);

create index if not exists invoices_order_id_idx
  on public.invoices (order_id);

create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id, sort_order);

create sequence if not exists public.invoice_number_seq start with 9002003500 increment by 1;

create or replace function public.allocate_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_n bigint;
begin
  next_n := nextval('public.invoice_number_seq');
  return next_n::text;
end;
$$;

grant execute on function public.allocate_invoice_number() to authenticated, service_role;

grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant usage, select on sequence public.invoice_number_seq to authenticated;
grant all on public.invoices to service_role;
grant all on public.invoice_items to service_role;
grant usage, select on sequence public.invoice_number_seq to service_role;

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "invoices staff read" on public.invoices;
create policy "invoices staff read" on public.invoices
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "invoices staff insert" on public.invoices;
create policy "invoices staff insert" on public.invoices
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

drop policy if exists "invoices staff update" on public.invoices;
create policy "invoices staff update" on public.invoices
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "invoice items staff read" on public.invoice_items;
create policy "invoice items staff read" on public.invoice_items
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "invoice items staff insert" on public.invoice_items;
create policy "invoice items staff insert" on public.invoice_items
  for insert to authenticated
  with check (public.is_staff(auth.uid()));

drop policy if exists "invoice items staff update" on public.invoice_items;
create policy "invoice items staff update" on public.invoice_items
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop policy if exists "invoice items staff delete" on public.invoice_items;
create policy "invoice items staff delete" on public.invoice_items
  for delete to authenticated
  using (public.is_staff(auth.uid()));

drop trigger if exists invoices_updated on public.invoices;
create trigger invoices_updated
  before update on public.invoices
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
