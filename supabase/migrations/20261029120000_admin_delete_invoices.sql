-- Atomic invoice delete (invoice_items cascade via FK).
-- Orders / customers keep history (invoices.order_id / customer_id are outbound FKs).

create or replace function public.admin_delete_invoices(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  -- Soft-block paid invoices so audit trail stays unless voided first.
  if exists (
    select 1 from public.invoices
    where id = any (p_ids) and status = 'paid'
  ) then
    raise exception 'Paid invoices cannot be deleted. Mark them void first, or keep them for records.';
  end if;

  delete from public.invoices where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_delete_invoices(uuid[]) from public;
grant execute on function public.admin_delete_invoices(uuid[]) to service_role;

notify pgrst, 'reload schema';
