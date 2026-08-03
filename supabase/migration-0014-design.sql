-- 0014 : chartes de couleurs propres à la marque, écrites depuis une description

create table if not exists brand_themes (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  cle text not null,                 -- identifiant court utilisé dans les adresses
  nom text not null,
  bg text not null,                  -- dégradé de fond
  accent text not null,              -- couleur vive des étiquettes
  photo text not null,               -- dégradé de remplacement sans photo
  source text not null default 'ia', -- ia ou manuel
  created_at timestamptz not null default now()
);
create unique index if not exists brand_themes_uniq on brand_themes (brand_id, cle);

alter table brand_themes enable row level security;
drop policy if exists brand_themes_by_brand on brand_themes;
create policy brand_themes_by_brand on brand_themes for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
