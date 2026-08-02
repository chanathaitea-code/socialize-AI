-- 0004 : stockage des médias (photos de marque), bucket public "media"
insert into storage.buckets (id, name, public) values ('media','media', true)
  on conflict (id) do update set public = true;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');

drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] in (select public.my_brand_ids()::text));

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] in (select public.my_brand_ids()::text));
