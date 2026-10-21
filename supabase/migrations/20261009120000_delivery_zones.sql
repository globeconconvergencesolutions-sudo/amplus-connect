-- Location-based delivery: HQ, distance bands, Jumia-style drop points.

create table if not exists public.delivery_settings (
  id integer primary key default 1 check (id = 1),
  hq_label text not null default 'Amplus yard, Mombasa Road, Nairobi',
  hq_lat double precision not null default -1.3308,
  hq_lng double precision not null default 36.8605,
  road_factor numeric not null default 1.30,
  max_km numeric not null default 600,
  quote_phone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_bands (
  id uuid primary key default gen_random_uuid(),
  km_from numeric not null,
  km_to numeric not null,
  fee_kes numeric not null,
  eta_days integer not null default 2,
  sort_order integer not null default 0,
  constraint delivery_bands_range check (km_to > km_from)
);

create table if not exists public.delivery_drop_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text not null,
  town text not null,
  landmark text not null,
  lat double precision not null,
  lng double precision not null,
  fee_override_kes numeric,
  eta_days_override integer,
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

grant select on public.delivery_settings to anon, authenticated;
grant update on public.delivery_settings to authenticated;
grant all on public.delivery_settings to service_role;

grant select on public.delivery_bands to anon, authenticated;
grant insert, update, delete on public.delivery_bands to authenticated;
grant all on public.delivery_bands to service_role;

grant select on public.delivery_drop_points to anon, authenticated;
grant insert, update, delete on public.delivery_drop_points to authenticated;
grant all on public.delivery_drop_points to service_role;

alter table public.delivery_settings enable row level security;
alter table public.delivery_bands enable row level security;
alter table public.delivery_drop_points enable row level security;

drop policy if exists "delivery settings read" on public.delivery_settings;
create policy "delivery settings read" on public.delivery_settings for select using (true);
drop policy if exists "delivery settings write" on public.delivery_settings;
create policy "delivery settings write" on public.delivery_settings
  for update to authenticated using (public.is_staff(auth.uid()));

drop policy if exists "delivery bands read" on public.delivery_bands;
create policy "delivery bands read" on public.delivery_bands for select using (true);
drop policy if exists "delivery bands write" on public.delivery_bands;
create policy "delivery bands write" on public.delivery_bands
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "delivery drop points read" on public.delivery_drop_points;
create policy "delivery drop points read" on public.delivery_drop_points
  for select using (is_active or public.is_staff(auth.uid()));
drop policy if exists "delivery drop points write" on public.delivery_drop_points;
create policy "delivery drop points write" on public.delivery_drop_points
  for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.delivery_settings (id) values (1) on conflict (id) do nothing;

insert into public.delivery_bands (km_from, km_to, fee_kes, eta_days, sort_order)
select * from (values
  (0::numeric, 15::numeric, 1500::numeric, 1, 10),
  (15::numeric, 40::numeric, 2500::numeric, 2, 20),
  (40::numeric, 100::numeric, 4500::numeric, 3, 30),
  (100::numeric, 250::numeric, 8000::numeric, 4, 40),
  (250::numeric, 600::numeric, 14000::numeric, 5, 50)
) as seed(km_from, km_to, fee_kes, eta_days, sort_order)
where not exists (select 1 from public.delivery_bands);

insert into public.delivery_drop_points (name, county, town, landmark, lat, lng, sort_order)
select * from (values
  ('Syokimau stage', 'Machakos', 'Syokimau', 'Syokimau Railway / stage, next to the railway station', -1.3546, 36.9365, 10),
  ('Kitengela stage', 'Kajiado', 'Kitengela', 'Kitengela town stage, Namanga Road', -1.4751, 36.9587, 20),
  ('Machakos town stage', 'Machakos', 'Machakos', 'Machakos bus stage / town centre', -1.5177, 37.2634, 30),
  ('Thika town stage', 'Kiambu', 'Thika', 'Thika town main stage', -1.0333, 37.0693, 40),
  ('Nakuru town stage', 'Nakuru', 'Nakuru', 'Nakuru town, opposite the old municipal market', -0.3031, 36.0800, 50),
  ('Kisumu Kibuye', 'Kisumu', 'Kisumu', 'Kibuye market / main stage area', -0.0917, 34.7680, 60),
  ('Mombasa Mwembe Tayari', 'Mombasa', 'Mombasa', 'Mwembe Tayari stage', -4.0435, 39.6682, 70),
  ('Westlands Sai Centre', 'Nairobi', 'Westlands', 'Sai Centre / Westlands roundabout area', -1.2684, 36.8110, 80)
) as seed(name, county, town, landmark, lat, lng, sort_order)
where not exists (select 1 from public.delivery_drop_points);

notify pgrst, 'reload schema';
