-- SocialFlow AI — Schéma initial (phase 0)
-- Postgres / Supabase. Isolation multi-tenant par organization_id + RLS.

create extension if not exists "uuid-ossp";

-- ============ Tenancy ============
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind text not null default 'brand' check (kind in ('brand','agency')),
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','agency_admin','brand_manager','client_validator','staff','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ============ Marques ============
create table brands (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  brand_brief jsonb not null default '{}'::jsonb, -- activité, ton, cible, objectifs, interdits...
  created_at timestamptz not null default now()
);

create table brand_identities (
  brand_id uuid primary key references brands(id) on delete cascade,
  colors jsonb not null default '[]'::jsonb,
  logo_url text,
  fonts jsonb not null default '[]'::jsonb
);

create table voice_rules (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  kind text not null check (kind in ('learned','banned_word','banned_topic','calibration')),
  rule text not null,
  created_at timestamptz not null default now()
);

-- ============ Lieux & produits ============
create table locations (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  address text,
  kind text not null default 'mobile' check (kind in ('mobile','fixed'))
);

create table location_schedule (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  day date not null,
  service text not null check (service in ('midi','soir','journee')),
  time_range text,
  status text not null default 'planned' check (status in ('planned','cancelled','done')),
  note text
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  price_cents int,
  location_prices jsonb default '{}'::jsonb,
  active boolean not null default true,
  out_of_stock boolean not null default false
);

-- ============ Comptes sociaux & médias ============
create table social_accounts (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','tiktok','gbp','linkedin','pinterest','youtube','threads','x')),
  handle text,
  provider text not null default 'aggregator' check (provider in ('aggregator','direct')),
  status text not null default 'connected' check (status in ('connected','expired','error','disabled')),
  encrypted_credentials text, -- chiffré applicativement, jamais en clair
  last_health_check timestamptz
);

create table account_health (
  id uuid primary key default uuid_generate_v4(),
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  checked_at timestamptz not null default now(),
  healthy boolean not null,
  detail text,
  alert_sent boolean not null default false
);

create table media_assets (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('photo','video','logo','template','music','doc')),
  ai_tags text[] not null default '{}',
  fresh boolean not null default true,
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ Plannings & contenus ============
create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null,
  starts_on date not null,
  ends_on date not null,
  objective text
);

create table monthly_plans (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  month date not null,
  theme text,
  goals jsonb default '{}'::jsonb,
  volumes jsonb default '{}'::jsonb, -- rythme par type
  ad_budget_cents int
);

create table content_slots (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  monthly_plan_id uuid references monthly_plans(id) on delete set null,
  scheduled_at timestamptz not null,
  format text not null check (format in ('post','story','reel','carousel','gbp_post','newsletter')),
  objective text,
  status text not null default 'planned' check (status in ('planned','generating','ready','cancelled','done'))
);

create table posts (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  content_slot_id uuid references content_slots(id) on delete set null,
  body text,
  media_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','pending_validation','approved','scheduled','grace','published','failed','cancelled','deleted')),
  guardrail_results jsonb default '{}'::jsonb,
  grace_until timestamptz, -- délai de grâce annulable
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table post_variants (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  platform text not null,
  body text,
  media_format text,
  external_id text, -- id de la publication chez la plateforme (pour correction/suppression)
  status text not null default 'pending'
);

-- ============ Réglages & audit ============
create table automation_settings (
  brand_id uuid primary key references brands(id) on delete cascade,
  mode text not null default 'assisted' check (mode in ('assisted','semi_auto','autonomous','paused','vacation')),
  grace_minutes int not null default 120,
  validation_rules jsonb not null default '{}'::jsonb, -- promos, prix, nouveaux lieux...
  publication_rates jsonb not null default '{}'::jsonb, -- par type / jour
  active_platforms text[] not null default '{instagram,facebook,gbp}',
  auto_reply_topics jsonb not null default '{}'::jsonb
);

create table audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid,
  actor text not null, -- user id ou 'system'
  action text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============ RLS ============
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table brands enable row level security;
alter table brand_identities enable row level security;
alter table voice_rules enable row level security;
alter table locations enable row level security;
alter table location_schedule enable row level security;
alter table products enable row level security;
alter table social_accounts enable row level security;
alter table account_health enable row level security;
alter table media_assets enable row level security;
alter table campaigns enable row level security;
alter table monthly_plans enable row level security;
alter table content_slots enable row level security;
alter table posts enable row level security;
alter table post_variants enable row level security;
alter table automation_settings enable row level security;
alter table audit_log enable row level security;

-- Appartenance : l'utilisateur voit les organisations dont il est membre
create policy org_member_select on organizations for select
  using (id in (select organization_id from memberships where user_id = auth.uid()));

create policy membership_self on memberships for select
  using (user_id = auth.uid()
     or organization_id in (select organization_id from memberships where user_id = auth.uid()));

-- Modèle de policy pour les tables liées à une marque (répliqué par table)
create policy brands_by_org on brands for all
  using (organization_id in (select organization_id from memberships where user_id = auth.uid()))
  with check (organization_id in (select organization_id from memberships where user_id = auth.uid()));

-- NB : les policies des tables filles (via brand_id) sont générées dans la migration 0002
-- selon le même motif : brand_id in (select b.id from brands b join memberships m
-- on m.organization_id = b.organization_id where m.user_id = auth.uid())
