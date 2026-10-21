-- Atomic staff delete helpers (service role / security definer).
-- Cascades: orders → order_items + payments; tickets → ticket messages.
-- Customers: delete auth.users (cascades profiles, orders, tickets, etc.).

create or replace function public.admin_delete_interest_leads(p_ids uuid[])
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
  delete from public.interest_leads where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_delete_contact_messages(p_ids uuid[])
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
  delete from public.contact_messages where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_delete_support_tickets(p_ids uuid[])
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
  -- support_ticket_messages cascade via ticket_id
  delete from public.support_tickets where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_delete_orders(p_ids uuid[])
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
  -- order_items + payments cascade; tickets/invoices/loyalty order_id set null
  delete from public.orders where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Full customer removal: delete auth.users rows (cascades profile, orders, tickets, etc.)
create or replace function public.admin_delete_customers(p_ids uuid[], p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n integer := 0;
  remaining_super integer;
  target uuid;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  if p_actor is not null and p_actor = any (p_ids) then
    raise exception 'You cannot delete your own account.';
  end if;

  foreach target in array p_ids loop
    select count(*)::integer into remaining_super
    from public.user_roles
    where role = 'super_admin'
      and user_id <> target;

    if exists (
      select 1 from public.user_roles where user_id = target and role = 'super_admin'
    ) and remaining_super < 1 then
      raise exception 'Cannot delete the last super admin.';
    end if;

    delete from auth.users where id = target;
    if found then
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.admin_delete_interest_leads(uuid[]) from public;
revoke all on function public.admin_delete_contact_messages(uuid[]) from public;
revoke all on function public.admin_delete_support_tickets(uuid[]) from public;
revoke all on function public.admin_delete_orders(uuid[]) from public;
revoke all on function public.admin_delete_customers(uuid[], uuid) from public;

grant execute on function public.admin_delete_interest_leads(uuid[]) to service_role;
grant execute on function public.admin_delete_contact_messages(uuid[]) to service_role;
grant execute on function public.admin_delete_support_tickets(uuid[]) to service_role;
grant execute on function public.admin_delete_orders(uuid[]) to service_role;
grant execute on function public.admin_delete_customers(uuid[], uuid) to service_role;

notify pgrst, 'reload schema';
