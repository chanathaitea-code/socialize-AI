"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Coupe ou relance la veille pour la marque courante.
 *
 * Écrit sur prospection_settings via le client habituel : la policy exige le
 * droit d'écriture au module. Aucune clé de service ici.
 */
export async function toggleVeille(formData: FormData) {
  const enable = String(formData.get("enable") ?? "") === "true";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect("/veille?err=Marque%20introuvable");

  const { error } = await supabase
    .from("prospection_settings")
    .update({ veille_enabled: enable })
    .eq("brand_id", brandId);

  if (error) {
    redirect("/veille?err=" + encodeURIComponent(error.message));
  }

  revalidatePath("/veille");
  redirect(
    "/veille?ok=" + encodeURIComponent(enable ? "Veille relancée" : "Veille coupée"),
  );
}
