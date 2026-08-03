-- 0007 : statistiques des publications (vues, portée, interactions)
-- Les chiffres sont recopiés chez nous car une story Instagram disparaît au
-- bout de 24 heures, ses statistiques avec elle.

alter table publication_log add column if not exists metrics jsonb not null default '{}'::jsonb;
alter table publication_log add column if not exists metrics_at timestamptz;

create index if not exists publication_log_recent on publication_log (brand_id, created_at desc);
