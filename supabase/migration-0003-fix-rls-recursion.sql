-- 0003 : correction de la récursion RLS (memberships) via fonctions SECURITY DEFINER
-- Symptôme : "infinite recursion detected in policy for relation memberships"
-- → toutes les lectures/écritures échouaient silencieusement côté application.

create or replace function public.my_org_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select organization_id from memberships where user_id = auth.uid() $$;

create or replace function public.my_brand_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select b.id from brands b
  where b.organization_id in (select organization_id from memberships where user_id = auth.uid()) $$;

grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.my_brand_ids() to authenticated;

drop policy if exists membership_self on memberships;
create policy membership_self on memberships for select using (user_id = auth.uid());

drop policy if exists org_member_select on organizations;
create policy org_member_select on organizations for select using (id in (select public.my_org_ids()));

drop policy if exists brands_by_org on brands;
create policy brands_by_org on brands for all
  using (organization_id in (select public.my_org_ids()))
  with check (organization_id in (select public.my_org_ids()));

do $$ declare t text; begin
  foreach t in array array['brand_identities','voice_rules','locations','location_schedule','products','social_accounts','media_assets','campaigns','monthly_plans','content_slots','posts','automation_settings'] loop
    execute format('drop policy if exists %I_by_brand on %I', t, t);
    execute format('create policy %I_by_brand on %I for all using (brand_id in (select public.my_brand_ids())) with check (brand_id in (select public.my_brand_ids()))', t, t);
  end loop; end $$;

drop policy if exists pv_by_post on post_variants;
create policy pv_by_post on post_variants for all
  using (post_id in (select p.id from posts p where p.brand_id in (select public.my_brand_ids())))
  with check (post_id in (select p.id from posts p where p.brand_id in (select public.my_brand_ids())));

drop policy if exists ah_by_account on account_health;
create policy ah_by_account on account_health for select
  using (social_account_id in (select s.id from social_accounts s where s.brand_id in (select public.my_brand_ids())));
