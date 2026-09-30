-- Customer and staff support tickets (payment follow-up and general issues).
-- Safe to re-run in the SQL editor.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  merchant_reference text,
  subject text,
  kind text not null default 'general'
    check (kind in ('payment_verification', 'general')),
  status text not null default 'open'
    check (status in ('open', 'waiting_on_us', 'waiting_on_you', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets add column if not exists subject text;

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  from_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets (user_id);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_ticket_messages_ticket_id_idx on public.support_ticket_messages (ticket_id);

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_ticket_messages to authenticated;
grant all on public.support_tickets to service_role;
grant all on public.support_ticket_messages to service_role;

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists "own or staff tickets read" on public.support_tickets;
create policy "own or staff tickets read" on public.support_tickets
  for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

drop policy if exists "own tickets insert" on public.support_tickets;
create policy "own tickets insert" on public.support_tickets
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "staff tickets update" on public.support_tickets;
create policy "staff tickets update" on public.support_tickets
  for update to authenticated
  using (public.is_staff(auth.uid()));

drop policy if exists "ticket messages read" on public.support_ticket_messages;
create policy "ticket messages read" on public.support_ticket_messages
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "ticket messages insert" on public.support_ticket_messages;
create policy "ticket messages insert" on public.support_ticket_messages
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and (
      public.is_staff(auth.uid())
      or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
