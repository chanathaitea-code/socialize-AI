-- 0013 : ligne éditoriale du mois (le calendrier) et stories hors emplacements

-- Le cap du mois : un thème, un produit à pousser, un objectif.
create table if not exists editorial_months (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  mois date not null,                       -- premier jour du mois
  theme text,
  produit_phare text,
  objectif text,
  lecture text,                             -- pourquoi ce cap, en trois phrases
  created_at timestamptz not null default now()
);
create unique index if not exists editorial_months_uniq on editorial_months (brand_id, mois);

-- Une case du calendrier : un contenu prévu un jour donné.
create table if not exists editorial_items (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  mois date not null,
  jour date not null,
  format text not null default 'story',     -- story, post, reel, avis
  gabarit text,                             -- plat, avis, coulisses, rebours, semaine, jour
  rubrique text,                            -- « Coulisses de préparation »
  objectif text,                            -- « Créer de la proximité »
  accroche text,
  texte text,
  hashtags text,
  conseil text,
  alertes text[] not null default '{}',
  statut text not null default 'prevu' check (statut in ('prevu','garde','rejete','programme','publie')),
  job_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists editorial_items_jour on editorial_items (brand_id, jour);

alter table editorial_months enable row level security;
drop policy if exists editorial_months_by_brand on editorial_months;
create policy editorial_months_by_brand on editorial_months for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));

alter table editorial_items enable row level security;
drop policy if exists editorial_items_by_brand on editorial_items;
create policy editorial_items_by_brand on editorial_items for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
