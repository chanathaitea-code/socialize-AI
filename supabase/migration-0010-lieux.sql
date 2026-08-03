-- 0010 : un lieu par marque, pour mettre en cache ses coordonnées (météo)
create unique index if not exists locations_brand_name_uniq on locations (brand_id, name);
