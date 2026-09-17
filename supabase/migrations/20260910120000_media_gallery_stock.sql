-- Media bucket, product galleries, and idempotent stock application on paid orders.

alter table public.products
  add column if not exists gallery jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists stock_applied boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_public_read" on storage.objects;
drop policy if exists "media_staff_insert" on storage.objects;
drop policy if exists "media_staff_update" on storage.objects;
drop policy if exists "media_staff_delete" on storage.objects;

create policy "media_public_read"
on storage.objects
for select
using (bucket_id = 'media');

create policy "media_staff_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'media' and public.is_staff(auth.uid()));

create policy "media_staff_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'media' and public.is_staff(auth.uid()))
with check (bucket_id = 'media' and public.is_staff(auth.uid()));

create policy "media_staff_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'media' and public.is_staff(auth.uid()));

create or replace function public.apply_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  applied boolean;
begin
  select stock_applied into applied
  from public.orders
  where id = p_order_id
  for update;

  if not found or applied then
    return;
  end if;

  update public.products as p
  set stock = greatest(0, p.stock - oi.quantity)
  from public.order_items as oi
  where oi.order_id = p_order_id
    and oi.product_id is not null
    and p.id = oi.product_id;

  update public.orders
  set stock_applied = true
  where id = p_order_id;
end;
$$;

create or replace function public.reverse_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  applied boolean;
begin
  select stock_applied into applied
  from public.orders
  where id = p_order_id
  for update;

  if not found or not applied then
    return;
  end if;

  update public.products as p
  set stock = p.stock + oi.quantity
  from public.order_items as oi
  where oi.order_id = p_order_id
    and oi.product_id is not null
    and p.id = oi.product_id;

  update public.orders
  set stock_applied = false
  where id = p_order_id;
end;
$$;

revoke all on function public.apply_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.reverse_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.apply_order_stock(uuid) to service_role;
grant execute on function public.reverse_order_stock(uuid) to service_role;
