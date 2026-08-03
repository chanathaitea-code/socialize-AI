-- 0011 : story automatique du matin (« on est là aujourd'hui »)
alter table story_auto add column if not exists jour_enabled boolean not null default false;
alter table story_auto add column if not exists jour_hour_paris int not null default 9;
alter table story_auto add column if not exists jour_targets text[] not null default array['instagram']::text[];
alter table story_auto add column if not exists jour_last_run date;
