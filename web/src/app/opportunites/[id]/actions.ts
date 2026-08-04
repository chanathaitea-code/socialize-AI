"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Nom du responsable, saisi à la main. Aucune API ne le donne : il s'obtient au
 * téléphone, et c'est là que se construit la vraie valeur du fichier. Contrairement
 * au numéro (licence Google, jamais stocké), ce nom est une donnée propre à la
 * marque : on l'enregistre en base.
 */
export async function updateContactName(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("contact_name") ?? "").trim();
  if (!id) redirect("/opportunites");

  const supabase = await supabaseServer();
  await supabase
    .from("opportunities")
    .update({ contact_name: name || null })
    .eq("id", id);

  revalidatePath(`/opportunites/${id}`);
}
