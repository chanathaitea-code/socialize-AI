-- 0005 : comptes sociaux connectés (Instagram + Page Facebook)
-- Complète la table social_accounts pour stocker l'identité du compte distant
-- et l'échéance du jeton. Le jeton lui-même reste chiffré applicativement
-- dans encrypted_credentials, jamais en clair.

alter table social_accounts add column if not exists external_id text;
alter table social_accounts add column if not exists display_name text;
alter table social_accounts add column if not exists token_expires_at timestamptz;
alter table social_accounts add column if not exists connected_at timestamptz not null default now();
alter table social_accounts add column if not exists details jsonb not null default '{}'::jsonb;

-- Un seul compte par plateforme et par marque : la reconnexion met à jour la ligne
create unique index if not exists social_accounts_brand_platform_uniq
  on social_accounts (brand_id, platform);

-- Journal des publications : trace lisible de ce qui est parti, quand, et où
create table if not exists publication_log (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  kind text not null default 'story',
  status text not null default 'published' check (status in ('published','failed','cancelled')),
  remote_id text,
  caption text,
  media_url text,
  error text,
  created_at timestamptz not null default now()
);

alter table publication_log enable row level security;

drop policy if exists publication_log_by_brand on publication_log;
create policy publication_log_by_brand on publication_log for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
