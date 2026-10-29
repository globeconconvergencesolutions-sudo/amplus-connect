-- Link orders to phone-first CRM customers.
-- Admin-created CRM orders may have no auth shopper (nullable user_id).

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_customer_id_idx
  on public.orders (customer_id);

-- Shop checkout still sets user_id; CRM staff orders may omit it.
alter table public.orders
  alter column user_id drop not null;

notify pgrst, 'reload schema';
