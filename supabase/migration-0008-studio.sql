-- 0008 : studio de contenu (propositions de publications rédigées par l'IA)

create table if not exists content_ideas (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  monday date not null,                  -- semaine concernée
  jour text,                             -- Lundi, Mardi... ou null si intemporel
  format text not null default 'post',   -- post, story, reel, avis, newsletter
  angle text,                            -- l'intention : coulisses, produit, emplacement...
  accroche text,
  texte text,
  hashtags text,
  conseil text,                          -- indication de tournage ou de visuel
  alertes text[] not null default '{}',  -- garde-fous : prix inconnu, mot interdit...
  statut text not null default 'propose' check (statut in ('propose','garde','rejete','publie')),
  created_at timestamptz not null default now()
);

create index if not exists content_ideas_semaine on content_ideas (brand_id, monday, created_at desc);

alter table content_ideas enable row level security;
drop policy if exists content_ideas_by_brand on content_ideas;
create policy content_ideas_by_brand on content_ideas for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
