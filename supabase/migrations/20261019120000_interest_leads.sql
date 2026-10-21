-- Expression of interest leads: no account required. Staff follow up by phone.

create table if not exists public.interest_leads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text,
  product_unit text,
  unit_price_kes numeric(12,2),
  full_name text not null,
  phone text not null,
  location text not null,
  email text,
  quantity numeric(12,2),
  notes text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'closed')),
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interest_leads_status_created_idx
  on public.interest_leads (status, created_at desc);

create index if not exists interest_leads_product_id_idx
  on public.interest_leads (product_id);

grant insert on public.interest_leads to anon, authenticated;
grant select, update on public.interest_leads to authenticated;
grant all on public.interest_leads to service_role;

alter table public.interest_leads enable row level security;

drop policy if exists "interest leads public insert" on public.interest_leads;
create policy "interest leads public insert" on public.interest_leads
  for insert to anon, authenticated
  with check (true);

drop policy if exists "interest leads staff read" on public.interest_leads;
create policy "interest leads staff read" on public.interest_leads
  for select to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "interest leads staff update" on public.interest_leads;
create policy "interest leads staff update" on public.interest_leads
  for update to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop trigger if exists interest_leads_updated on public.interest_leads;
create trigger interest_leads_updated
  before update on public.interest_leads
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
