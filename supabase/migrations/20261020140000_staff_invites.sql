-- Staff invites: super-admin provisions Auth users + roles; set-password links go via app mail (Gmail/Resend).

create table if not exists public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  token_hash text,
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  full_name text,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  constraint staff_invites_pending_token check (
    status <> 'pending' or (token_hash is not null and expires_at is not null)
  )
);

create unique index if not exists staff_invites_one_pending_email_idx
  on public.staff_invites (lower(email))
  where status = 'pending';

create index if not exists staff_invites_status_created_idx
  on public.staff_invites (status, created_at desc);

create index if not exists staff_invites_user_id_idx
  on public.staff_invites (user_id);

create index if not exists staff_invites_token_hash_idx
  on public.staff_invites (token_hash)
  where token_hash is not null;

alter table public.staff_invites enable row level security;

revoke all on table public.staff_invites from public, anon, authenticated;
grant all on table public.staff_invites to service_role;

-- Super admins can read invites in the dashboard (writes stay on service role).
drop policy if exists "staff invites super admin read" on public.staff_invites;
create policy "staff invites super admin read" on public.staff_invites
  for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

grant select on table public.staff_invites to authenticated;

notify pgrst, 'reload schema';
