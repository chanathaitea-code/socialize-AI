-- 0002 : policies des tables filles (via brand_id) + bootstrap de compte
do $$
declare t text;
begin
  foreach t in array array['brand_identities','voice_rules','locations','location_schedule','products','social_accounts','media_assets','campaigns','monthly_plans','content_slots','posts','automation_settings']
  loop
    execute format('create policy %I_by_brand on %I for all using (brand_id in (select b.id from brands b join memberships m on m.organization_id = b.organization_id where m.user_id = auth.uid())) with check (brand_id in (select b.id from brands b join memberships m on m.organization_id = b.organization_id where m.user_id = auth.uid()))', t, t);
  end loop;
end $$;

create policy pv_by_post on post_variants for all
  using (post_id in (select p.id from posts p join brands b on b.id = p.brand_id join memberships m on m.organization_id = b.organization_id where m.user_id = auth.uid()))
  with check (post_id in (select p.id from posts p join brands b on b.id = p.brand_id join memberships m on m.organization_id = b.organization_id where m.user_id = auth.uid()));

create policy ah_by_account on account_health for select
  using (social_account_id in (select s.id from social_accounts s join brands b on b.id = s.brand_id join memberships m on m.organization_id = b.organization_id where m.user_id = auth.uid()));

-- Création automatique organisation + marque + réglages à la première connexion
create or replace function public.bootstrap_account(p_name text default 'Ma marque')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_brand uuid;
begin
  select organization_id into v_org from memberships where user_id = auth.uid() limit 1;
  if v_org is not null then return v_org; end if;
  insert into organizations(name) values (p_name) returning id into v_org;
  insert into memberships(organization_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into brands(organization_id, name) values (v_org, p_name) returning id into v_brand;
  insert into automation_settings(brand_id) values (v_brand);
  return v_org;
end $$;
revoke all on function public.bootstrap_account(text) from public;
grant execute on function public.bootstrap_account(text) to authenticated;
