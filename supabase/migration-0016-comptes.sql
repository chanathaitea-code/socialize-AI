-- 0016 : ouverture à plusieurs entreprises (identité de marque et parcours d'entrée)

alter table brands add column if not exists handle text;      -- @compte instagram
alter table brands add column if not exists website text;     -- adresse du site
alter table brands add column if not exists city text;        -- ville de rattachement
alter table brands add column if not exists onboarded boolean not null default false;

-- Les comptes déjà en place sont considérés comme configurés
update brands set onboarded = true where onboarded = false and brand_brief ? 'activite';
