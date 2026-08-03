-- 0012 : rapports mensuels conservés (les chiffres de Meta s'effacent avec le temps)
create table if not exists monthly_reports (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid not null references brands(id) on delete cascade,
  mois date not null,
  contenu jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists monthly_reports_uniq on monthly_reports (brand_id, mois);
alter table monthly_reports enable row level security;
drop policy if exists monthly_reports_by_brand on monthly_reports;
create policy monthly_reports_by_brand on monthly_reports for all
  using (brand_id in (select public.my_brand_ids()))
  with check (brand_id in (select public.my_brand_ids()));
