-- Cancel unpaid orders atomically: reverse stock if applied, restore loyalty,
-- mark payments and the order CANCELLED. Safe to re-run.

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists orders_unpaid_reminder_idx
  on public.orders (created_at)
  where status = 'PENDING_PAYMENT' and reminder_sent_at is null;

create or replace function public.cancel_unpaid_order(
  p_order_id uuid,
  p_allow_processing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  restored integer := 0;
  items jsonb;
begin
  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price_kes', oi.unit_price_kes
      )
      order by oi.created_at
    ),
    '[]'::jsonb
  )
  into items
  from public.order_items oi
  where oi.order_id = p_order_id;

  if o.status = 'CANCELLED' then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'points_restored', 0,
      'merchant_reference', o.merchant_reference,
      'items', items
    );
  end if;

  if o.status in ('PAID', 'FULFILLED', 'SHIPPED', 'DELIVERED', 'REFUND_REQUESTED') then
    raise exception 'This order is already paid or fulfilled and cannot be cancelled';
  end if;

  if o.status = 'PAYMENT_PROCESSING' and not p_allow_processing then
    raise exception 'This order is waiting for payment confirmation';
  end if;

  if o.status not in ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'PAYMENT_PROCESSING', 'PAYMENT_REVERSED') then
    raise exception 'This order cannot be cancelled';
  end if;

  perform public.reverse_order_stock(p_order_id);

  if o.points_redeemed > 0
     and not exists (
       select 1
       from public.loyalty_transactions lt
       where lt.order_id = p_order_id
         and lt.kind = 'redeem_restored'
     ) then
    update public.profiles
    set loyalty_points = loyalty_points + o.points_redeemed
    where id = o.user_id;
    insert into public.loyalty_transactions (user_id, order_id, points, kind, note)
    values (
      o.user_id,
      p_order_id,
      o.points_redeemed,
      'redeem_restored',
      'Restored after cancelling ' || o.merchant_reference
    );
    restored := o.points_redeemed;
  end if;

  update public.payments
  set
    internal_status = 'CANCELLED',
    provider_status = coalesce(provider_status, 'CANCELLED'),
    updated_at = now()
  where order_id = p_order_id;

  update public.orders
  set
    status = 'CANCELLED',
    cancelled_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'points_restored', restored,
    'merchant_reference', o.merchant_reference,
    'items', items
  );
end;
$$;

revoke all on function public.cancel_unpaid_order(uuid, boolean) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_order(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
