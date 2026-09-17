
create type public.app_role as enum ('super_admin','content_manager','ecommerce_manager','rewards_manager','viewer');
create type public.loyalty_tier as enum ('bronze','silver','gold');
create type public.order_status as enum ('PENDING_PAYMENT','PAYMENT_PROCESSING','PAID','PAYMENT_FAILED','PAYMENT_REVERSED','CANCELLED','FULFILLED','SHIPPED','DELIVERED','REFUND_REQUESTED');

create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql set search_path = public;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  phone text,
  loyalty_points integer not null default 0,
  tier public.loyalty_tier not null default 'bronze',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id);
$$;

create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id or public.is_staff(auth.uid()));
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id or public.has_role(auth.uid(),'rewards_manager') or public.has_role(auth.uid(),'super_admin'));
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'super_admin'));

-- signup trigger
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
grant insert, update, delete on public.categories to authenticated;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select using (true);
create policy "categories staff write" on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'ecommerce_manager') or public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'ecommerce_manager') or public.has_role(auth.uid(),'super_admin'));

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  specifications jsonb not null default '{}'::jsonb,
  price_kes numeric(12,2) not null default 0,
  stock integer not null default 0,
  unit text not null default 'unit',
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  brand text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select using (is_active or public.is_staff(auth.uid()));
create policy "products staff write" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'ecommerce_manager') or public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'ecommerce_manager') or public.has_role(auth.uid(),'super_admin'));
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

-- services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  image_url text,
  icon text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "services public read" on public.services for select using (is_published or public.is_staff(auth.uid()));
create policy "services staff write" on public.services for all to authenticated
  using (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'));

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  sector text,
  location text,
  client text,
  summary text,
  description text,
  image_url text,
  gallery jsonb not null default '[]'::jsonb,
  completed_on date,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "projects public read" on public.projects for select using (is_published or public.is_staff(auth.uid()));
create policy "projects staff write" on public.projects for all to authenticated
  using (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'));

-- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  category text,
  tags text[] not null default '{}',
  image_url text,
  author text,
  is_published boolean not null default false,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts public read" on public.posts for select using (is_published or public.is_staff(auth.uid()));
create policy "posts staff write" on public.posts for all to authenticated
  using (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'content_manager') or public.has_role(auth.uid(),'super_admin'));

-- addresses
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  county text,
  town text,
  street text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;
create policy "own addresses" on public.addresses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wishlist
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
grant select, insert, delete on public.wishlist_items to authenticated;
grant all on public.wishlist_items to service_role;
alter table public.wishlist_items enable row level security;
create policy "own wishlist" on public.wishlist_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  merchant_reference text not null unique,
  status public.order_status not null default 'PENDING_PAYMENT',
  subtotal_kes numeric(12,2) not null default 0,
  delivery_fee_kes numeric(12,2) not null default 0,
  points_redeemed integer not null default 0,
  discount_kes numeric(12,2) not null default 0,
  total_kes numeric(12,2) not null default 0,
  delivery_option text,
  delivery_address jsonb,
  customer_email text,
  customer_phone text,
  points_awarded boolean not null default false,
  fulfilment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "own orders insert" on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy "orders staff update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'ecommerce_manager') or public.has_role(auth.uid(),'super_admin'));
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_kes numeric(12,2) not null,
  quantity integer not null default 1,
  line_total_kes numeric(12,2) not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "own order items read" on public.order_items for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "own order items insert" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  merchant_reference text not null,
  order_tracking_id text,
  amount_kes numeric(12,2) not null,
  currency text not null default 'KES',
  payment_method text,
  masked_account text,
  confirmation_code text,
  provider_status text,
  internal_status public.order_status not null default 'PENDING_PAYMENT',
  provider_response jsonb,
  callback_at timestamptz,
  ipn_at timestamptz,
  refund_status text,
  refund_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments read" on public.payments for select to authenticated
  using (public.is_staff(auth.uid()) or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();

-- loyalty
create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (order_id, kind)
);
grant select on public.loyalty_transactions to authenticated;
grant all on public.loyalty_transactions to service_role;
alter table public.loyalty_transactions enable row level security;
create policy "own loyalty read" on public.loyalty_transactions for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));

create table public.loyalty_settings (
  id integer primary key default 1,
  kes_per_point numeric(10,2) not null default 100,
  point_value_kes numeric(10,2) not null default 1,
  silver_threshold integer not null default 500,
  gold_threshold integer not null default 2000,
  max_redeem_percent integer not null default 20,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
grant select on public.loyalty_settings to anon, authenticated;
grant update on public.loyalty_settings to authenticated;
grant all on public.loyalty_settings to service_role;
alter table public.loyalty_settings enable row level security;
create policy "loyalty settings read" on public.loyalty_settings for select using (true);
create policy "loyalty settings write" on public.loyalty_settings for update to authenticated
  using (public.has_role(auth.uid(),'rewards_manager') or public.has_role(auth.uid(),'super_admin'));
insert into public.loyalty_settings (id) values (1);

-- contact
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
create policy "anyone can send" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "staff read messages" on public.contact_messages for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff update messages" on public.contact_messages for update to authenticated using (public.is_staff(auth.uid()));

-- seed content
insert into public.categories (name, slug, description, sort_order) values
  ('Cement & Aggregates','cement-aggregates','Cement, ballast, sand and hardcore',1),
  ('Steel & Reinforcement','steel-reinforcement','Rebar, mesh, hollow sections and sheets',2),
  ('Roofing','roofing','Iron sheets, tiles and accessories',3),
  ('Paints & Finishes','paints-finishes','Interior and exterior finishes',4),
  ('Plumbing','plumbing','Pipes, fittings and sanitary ware',5),
  ('Tools & Safety','tools-safety','Hand tools, power tools and PPE',6);

insert into public.products (name, slug, short_description, description, price_kes, stock, unit, category_id, brand, is_featured, specifications, image_url)
select v.name, v.slug, v.short_desc, v.long_desc, v.price, v.stock, v.unit, c.id, v.brand, v.featured, v.specs, v.img
from (values
  ('Portland Cement 32.5N - 50kg','portland-cement-32-5n-50kg','General purpose cement for masonry and concrete works.','A reliable 50kg bag of 32.5N Portland cement suitable for plastering, masonry and general concrete works on residential and commercial sites.',780.00,1200,'bag','cement-aggregates','Amplus Select',true,'{"Grade":"32.5N","Weight":"50 kg","Packaging":"Paper bag"}'::jsonb,null),
  ('Portland Cement 42.5N - 50kg','portland-cement-42-5n-50kg','High strength cement for structural concrete.','Higher grade 42.5N cement for structural elements such as columns, beams and suspended slabs.',890.00,800,'bag','cement-aggregates','Amplus Select',true,'{"Grade":"42.5N","Weight":"50 kg"}'::jsonb,null),
  ('Machine Cut Ballast 3/4"','machine-cut-ballast-34','Clean graded ballast for concrete mixes.','Washed and graded 3/4 inch machine cut ballast delivered per tonne within Nairobi metro.',2400.00,300,'tonne','cement-aggregates','Amplus Quarry',false,'{"Size":"3/4 inch","Sold as":"Per tonne"}'::jsonb,null),
  ('Deformed Steel Bar Y12 - 12m','deformed-steel-bar-y12','Y12 high tensile reinforcement bar.','High tensile deformed reinforcement bar, 12mm diameter, 12 metre length, KEBS certified.',1450.00,600,'length','steel-reinforcement','SteelCore',true,'{"Diameter":"12 mm","Length":"12 m","Standard":"KS 573"}'::jsonb,null),
  ('BRC Mesh A142 Sheet','brc-mesh-a142','Welded reinforcement mesh for slabs.','A142 welded steel fabric mesh for slabs, driveways and screeds.',5200.00,150,'sheet','steel-reinforcement','SteelCore',false,'{"Reference":"A142","Sheet size":"4.8m x 2.4m"}'::jsonb,null),
  ('Pre-painted Iron Sheets 30G','pre-painted-iron-sheets-30g','Durable roofing sheets in multiple colours.','Gauge 30 pre-painted corrugated iron sheets with a 10 year colour warranty. Sold per metre.',720.00,900,'metre','roofing','RoofPro',true,'{"Gauge":"30","Coating":"Pre-painted","Warranty":"10 years"}'::jsonb,null),
  ('Stone Coated Roof Tiles','stone-coated-roof-tiles','Premium stone coated steel tiles.','Lightweight stone coated steel roofing tiles offering a premium finish with excellent durability.',1350.00,400,'sqm','roofing','RoofPro',false,'{"Finish":"Stone coated","Coverage":"Per square metre"}'::jsonb,null),
  ('Vinyl Silk Emulsion 20L','vinyl-silk-emulsion-20l','Washable interior emulsion paint.','Premium washable vinyl silk emulsion for interior walls and ceilings. Tintable to any shade.',6800.00,220,'bucket','paints-finishes','ChromaPlus',true,'{"Volume":"20 L","Finish":"Silk","Coverage":"12 sqm/L"}'::jsonb,null),
  ('Weatherguard Exterior Paint 20L','weatherguard-exterior-paint-20l','All weather exterior protection.','Acrylic exterior paint with fungicidal protection engineered for the Kenyan climate.',8900.00,180,'bucket','paints-finishes','ChromaPlus',false,'{"Volume":"20 L","Finish":"Matt"}'::jsonb,null),
  ('PPR Hot Water Pipe 25mm','ppr-hot-water-pipe-25mm','Pressure rated hot water pipe.','PN20 PPR pipe for hot and cold water reticulation, 4 metre length.',980.00,500,'length','plumbing','FlowLine',false,'{"Diameter":"25 mm","Rating":"PN20","Length":"4 m"}'::jsonb,null),
  ('Close Coupled WC Suite','close-coupled-wc-suite','Complete WC with cistern and seat.','Ceramic close coupled WC suite complete with dual flush cistern and soft close seat.',14500.00,60,'set','plumbing','FlowLine',true,'{"Flush":"Dual 3/6L","Includes":"Pan, cistern, seat"}'::jsonb,null),
  ('Site Safety Starter Kit','site-safety-starter-kit','Helmet, vest, gloves and boots.','Complete PPE starter kit: hard hat, reflective vest, gloves, goggles and safety boots.',4600.00,120,'kit','tools-safety','GuardWell',false,'{"Includes":"Helmet, vest, gloves, goggles, boots"}'::jsonb,null),
  ('Cordless Impact Drill 18V','cordless-impact-drill-18v','Two battery cordless drill set.','18V brushless cordless impact drill with two batteries, charger and carry case.',18900.00,45,'unit','tools-safety','ToughDrive',true,'{"Voltage":"18 V","Batteries":"2 x 4.0Ah"}'::jsonb,null)
) as v(name, slug, short_desc, long_desc, price, stock, unit, cat_slug, brand, featured, specs, img)
join public.categories c on c.slug = v.cat_slug;

insert into public.services (title, slug, summary, description, sort_order, icon, seo_description) values
  ('Building Construction','building-construction','Turnkey residential, commercial and institutional construction.','Amplus delivers complete building construction from groundworks to handover. Our teams manage structural works, masonry, roofing, finishes and external works under a single accountable contract, with rigorous quality checks at every stage.',1,'building','Turnkey building construction services for residential, commercial and institutional projects in Kenya.'),
  ('Civil & Infrastructure Works','civil-infrastructure-works','Roads, drainage, water reticulation and site development.','We undertake civil works including access roads, parking, storm water drainage, sewer reticulation, boreholes and bulk earthworks, backed by modern plant and certified supervision.',2,'road','Civil and infrastructure construction: roads, drainage, water reticulation and earthworks.'),
  ('Design & Build','design-and-build','Single point responsibility from concept to completion.','Our design and build teams combine architectural, structural and services design with construction delivery, shortening programmes and giving clients one accountable partner.',3,'compass','Design and build construction delivery with a single point of responsibility.'),
  ('Renovation & Fit-Out','renovation-and-fit-out','Refurbishment, partitioning and interior fit-out.','From office fit-outs to full building refurbishment, we work in occupied environments with careful phasing, dust control and out of hours programmes.',4,'ruler','Office and building renovation and interior fit-out services.'),
  ('Project Management','project-management','Cost, programme and quality control on your behalf.','Independent project management covering procurement, cost control, programme monitoring, quality assurance and contract administration.',5,'clipboard','Construction project management, cost control and contract administration.'),
  ('Materials Supply','materials-supply','Verified construction materials delivered to site.','Our online store supplies cement, steel, roofing, finishes, plumbing and tools with transparent pricing and scheduled site delivery across Kenya.',6,'truck','Construction materials supply and delivery across Kenya.');

insert into public.projects (title, slug, sector, location, client, summary, description, completed_on, is_featured, seo_description) values
  ('Riverside Office Park','riverside-office-park','Commercial','Nairobi','Riverside Holdings','A five storey grade A office development with basement parking.','Amplus delivered the structural works, envelope and finishes for a five storey office development including two basement parking levels, landscaped forecourt and standby power infrastructure.','2025-11-30',true,'Five storey grade A office development delivered by Amplus in Nairobi.'),
  ('Karen Ridge Residences','karen-ridge-residences','Residential','Karen, Nairobi','Private Client','Twelve luxury townhouses with shared amenities.','Construction of twelve four bedroom townhouses with a clubhouse, swimming pool, borehole and internal access roads, completed within a 20 month programme.','2025-06-15',true,'Luxury townhouse development in Karen delivered by Amplus Construction Solutions.'),
  ('Thika Industrial Warehouse','thika-industrial-warehouse','Industrial','Thika','Sanaa Logistics','A 6,000 sqm steel portal frame warehouse.','Design and build of a 6,000 square metre steel portal frame warehouse with loading bays, office block, heavy duty concrete hardstanding and fire reticulation.','2024-12-20',true,'6,000 sqm industrial warehouse design and build project in Thika.'),
  ('Nakuru Community Health Centre','nakuru-community-health-centre','Institutional','Nakuru','County Government','Outpatient facility with laboratory and pharmacy.','Construction of a level three outpatient facility including consultation rooms, laboratory, pharmacy, medical gas installation and solar backup.','2024-08-08',false,'Community health centre construction project in Nakuru.'),
  ('Mombasa Road Retail Fit-Out','mombasa-road-retail-fit-out','Retail','Mombasa Road, Nairobi','Urban Retail Group','A 1,200 sqm anchor store fit-out delivered in phases.','Interior fit-out of a 1,200 square metre anchor retail store completed in occupied premises over night shifts, covering ceilings, flooring, joinery, HVAC and electrical.','2025-03-01',false,'Retail interior fit-out project on Mombasa Road, Nairobi.'),
  ('Limuru Water Reticulation','limuru-water-reticulation','Infrastructure','Limuru','Water Services Board','8 km of distribution mains and a storage tank.','Laying of 8 kilometres of water distribution mains, construction of a 500 cubic metre storage tank and installation of pumping and metering infrastructure.','2024-04-18',false,'Water reticulation and storage infrastructure project in Limuru.');

insert into public.posts (title, slug, excerpt, body, category, tags, author, is_published, published_at, seo_description) values
  ('Choosing the right cement grade for your project','choosing-the-right-cement-grade','32.5N or 42.5N? A practical guide for Kenyan sites.','Cement grade affects both cost and structural performance. 32.5N is well suited to masonry, plaster and general concrete, while 42.5N gains strength faster and suits columns, beams and suspended slabs. Always confirm the mix design with your structural engineer, store bags off the ground, and use stock within three months of manufacture.','Materials','{cement,materials}','Amplus Technical Team',true,now() - interval '5 days','A practical guide to selecting between 32.5N and 42.5N cement for construction projects in Kenya.'),
  ('Five ways to keep a build on programme','five-ways-to-keep-a-build-on-programme','Programme slippage is usually a procurement problem.','Most delays trace back to late material decisions. Lock down finishes early, order long lead items before they are needed, keep a rolling four week look-ahead, hold weekly site coordination meetings, and track cash flow against the works programme.','Project Management','{programme,planning}','Amplus Technical Team',true,now() - interval '18 days','Five practical steps to keep a construction project on programme and on budget.'),
  ('Roofing choices for the Kenyan climate','roofing-choices-for-the-kenyan-climate','Comparing pre-painted sheets, stone coated tiles and concrete tiles.','Pre-painted iron sheets remain the most cost effective roofing option, while stone coated steel tiles offer a premium look at low weight. Consider rainfall intensity, roof pitch, insulation needs and long term maintenance before committing.','Materials','{roofing,materials}','Amplus Technical Team',true,now() - interval '32 days','Comparing roofing materials for Kenyan buildings: iron sheets, stone coated tiles and concrete tiles.');
