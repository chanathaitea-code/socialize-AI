"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { MOIS } from "@/lib/semaine";
import { premierDuMois } from "@/lib/rapport";
import { enregistrerPlan } from "@/lib/ligne";

const borne = (raw: unknown) => Math.max(-1, Math.min(3, parseInt(String(raw ?? "0"), 10) || 0));

/** Établit — ou refait — la ligne éditoriale d'un mois. */
export async function etablirLigne(formData: FormData) {
  const decalage = borne(formData.get("decalage"));
  const retour = (p: string) => redirect(`/calendrier?m=${decalage}&${p}`);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brand = brands?.[0];
  if (!brand) retour("err=Marque%20introuvable");

  const mois = premierDuMois(decalage);

  try {
    const { nombre } = await enregistrerPlan(supabase, brand!.id, mois);
    revalidatePath("/calendrier");
    retour(
      `ok=${encodeURIComponent(`Ligne éditoriale de ${MOIS[mois.getUTCMonth()]} établie : ${nombre} contenus`)}`
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "génération impossible")}`);
  }
}

/** Garder ou écarter un contenu du calendrier. */
export async function changerStatutItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const statut = String(formData.get("statut") ?? "garde");
  const decalage = borne(formData.get("decalage"));
  if (!id) return;
  const supabase = await supabaseServer();
  await supabase.from("editorial_items").update({ statut }).eq("id", id);
  revalidatePath("/calendrier");
  redirect(`/calendrier?m=${decalage}`);
}

/** Supprimer une case du calendrier. */
export async function supprimerItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decalage = borne(formData.get("decalage"));
  if (!id) return;
  const supabase = await supabaseServer();
  await supabase.from("editorial_items").delete().eq("id", id);
  revalidatePath("/calendrier");
  redirect(`/calendrier?m=${decalage}`);
}
