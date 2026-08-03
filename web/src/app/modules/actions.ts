"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { MODULES, type AppModule } from "@/lib/modules";

const ADMIN_ROLES = new Set(["owner", "agency_admin"]);

function isModule(v: string): v is AppModule {
  return (MODULES as readonly string[]).includes(v);
}

/** Membership de l'utilisateur courant, avec le rôle pour décider des droits. */
async function currentContext() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { supabase, user, membership };
}

export async function toggleOrgModule(formData: FormData) {
  const mod = String(formData.get("module") ?? "");
  const enable = String(formData.get("enable") ?? "") === "true";
  if (!isModule(mod)) redirect("/modules?err=Module%20inconnu");

  const { supabase, user, membership } = await currentContext();
  if (!membership || !ADMIN_ROLES.has(membership.role)) {
    redirect("/modules?err=" + encodeURIComponent("Réservé aux administrateurs"));
  }
  const orgId = membership.organization_id;

  try {
    if (enable) {
      const row: Record<string, unknown> = {
        organization_id: orgId,
        module: mod,
        enabled: true,
        deactivated_at: null,
      };
      // La prospection engage un avenant : on trace qui l'accepte et quand.
      if (mod === "prospection") {
        row.terms_accepted_at = new Date().toISOString();
        row.terms_accepted_by = user.id;
      }
      const { error } = await supabase
        .from("organization_modules")
        .upsert(row, { onConflict: "organization_id,module" });
      if (error) throw error;

      // Semer les poids de scoring pour les marques qui n'en ont pas encore.
      if (mod === "prospection") {
        const { data: brands } = await supabase
          .from("brands")
          .select("id")
          .eq("organization_id", orgId);
        for (const b of brands ?? []) {
          await supabase.rpc("seed_scoring_weights_for_brand", { b: b.id });
        }
      }
    } else {
      // Désactiver retire les accès membres (trigger en base) : voulu.
      const { error } = await supabase
        .from("organization_modules")
        .update({ enabled: false, deactivated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("module", mod);
      if (error) throw error;
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(
      "/modules?err=" +
        encodeURIComponent(e instanceof Error ? e.message : "Action impossible"),
    );
  }

  revalidatePath("/modules");
  redirect("/modules?ok=" + encodeURIComponent("Modules de l'organisation mis à jour"));
}

export async function toggleMemberModule(formData: FormData) {
  const membershipId = String(formData.get("membership_id") ?? "");
  const mod = String(formData.get("module") ?? "");
  const grant = String(formData.get("grant") ?? "") === "true";
  if (!isModule(mod) || !membershipId) redirect("/modules?err=Requête%20invalide");

  const { supabase, membership } = await currentContext();
  if (!membership || !ADMIN_ROLES.has(membership.role)) {
    redirect("/modules?err=" + encodeURIComponent("Réservé aux administrateurs"));
  }
  const orgId = membership.organization_id;

  try {
    if (grant) {
      // Le trigger refuse si l'organisation n'a pas le module : c'est le verrou.
      const { error } = await supabase
        .from("membership_modules")
        .upsert(
          { membership_id: membershipId, organization_id: orgId, module: mod },
          { onConflict: "membership_id,module" },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("membership_modules")
        .delete()
        .eq("membership_id", membershipId)
        .eq("module", mod);
      if (error) throw error;
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(
      "/modules?err=" +
        encodeURIComponent(e instanceof Error ? e.message : "Action impossible"),
    );
  }

  revalidatePath("/modules");
  redirect("/modules?ok=" + encodeURIComponent("Accès du membre mis à jour"));
}
