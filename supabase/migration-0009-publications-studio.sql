-- 0009 : publier une proposition du studio (photo + légende) et non plus
-- seulement la story hebdomadaire des emplacements.

alter table story_jobs add column if not exists kind text not null default 'semaine';
alter table story_jobs add column if not exists idea_id uuid references content_ideas(id) on delete set null;
alter table story_jobs add column if not exists format text not null default 'story';
