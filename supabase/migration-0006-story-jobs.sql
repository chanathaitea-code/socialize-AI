-- 0006 : envois programmés de la story (délai de grâce annulable + rendez-vous hebdomadaire)

create table if not exists story_jobs (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  run_at timestamptz not null,
  monday date not null,                       -- semaine que la story doit représenter
  theme text not null default 'vert',
  media_path text,                            -- photo choisie, sinon fond ou illustration
  fond text,
  caption text,
  targets text[] not null default '{instagram,facebook}',
  origin text not null default 'manuel' check (origin in ('manuel','hebdo')),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','published','failed')),
  error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists story_jobs_a_faire on story_jobs (status, run_at);

alter table story_jobs enable row level security;
drop policy if exists story_jobs_by_brand on story_jobs;
create policy story_jobs_by_brand on story_jobs for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));

-- Rendez-vous hebdomadaire : une ligne par marque
create table if not exists story_auto (
  brand_id uuid primary key references brands(id) on delete cascade,
  enabled boolean not null default false,
  weekday int not null default 7,             -- 1 = lundi ... 7 = dimanche
  hour_paris int not null default 18,
  grace_minutes int not null default 15,
  theme text not null default 'vert',
  targets text[] not null default '{instagram,facebook}',
  last_run_week date
);

alter table story_auto enable row level security;
drop policy if exists story_auto_by_brand on story_auto;
create policy story_auto_by_brand on story_auto for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
