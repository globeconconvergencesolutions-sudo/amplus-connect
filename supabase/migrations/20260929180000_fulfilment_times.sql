-- Optional timestamps for the delivery timeline. Status remains the source of truth.

alter table public.orders
  add column if not exists prepared_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

notify pgrst, 'reload schema';
