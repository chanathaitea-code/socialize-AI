-- 0015 : pilote automatique (ligne éditoriale, compte à rebours, plat, jours sans service, calendrier)

alter table story_auto add column if not exists ligne_auto boolean not null default false;
alter table story_auto add column if not exists rebours_enabled boolean not null default false;
alter table story_auto add column if not exists plat_enabled boolean not null default false;
alter table story_auto add column if not exists plat_jours int[] not null default '{2,5}';
alter table story_auto add column if not exists plat_heure int not null default 11;
alter table story_auto add column if not exists envie_enabled boolean not null default false;
alter table story_auto add column if not exists envie_heure int not null default 12;
alter table story_auto add column if not exists calendrier_auto boolean not null default false;
alter table story_auto add column if not exists auto_grace int not null default 30;
alter table story_auto add column if not exists auto_targets text[] not null default '{instagram}';

-- Une règle ne doit se déclencher qu'une fois par occasion
create table if not exists auto_runs (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  cle text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists auto_runs_uniq on auto_runs (brand_id, cle);

alter table auto_runs enable row level security;
drop policy if exists auto_runs_by_brand on auto_runs;
create policy auto_runs_by_brand on auto_runs for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
