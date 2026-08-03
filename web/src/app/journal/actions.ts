"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { dechiffrer } from "@/lib/crypto";

/** Annule un envoi programmé qui n'est pas encore parti. */
export async function annulerEnvoi(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("story_jobs")
    .update({ status: "cancelled", done_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) redirect(`/journal?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/journal");
  redirect("/journal?ok=Envoi%20annul%C3%A9");
}

/**
 * Supprime une publication déjà partie. Facebook accepte la suppression par
 * l'API ; Instagram ne la propose pas, il faut passer par l'application.
 */
export async function supprimerPublication(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: ligne } = await supabase
    .from("publication_log")
    .select("id, platform, remote_id, brand_id")
    .eq("id", id)
    .single();
  if (!ligne?.remote_id) redirect("/journal?err=Publication%20introuvable");

  if (ligne.platform !== "facebook") {
    redirect("/journal?err=Instagram%20ne%20permet%20pas%20la%20suppression%20à%20distance%20%3A%20supprimez%20la%20story%20depuis%20l%27application");
  }

  const { data: compte } = await supabase
    .from("social_accounts")
    .select("encrypted_credentials")
    .eq("brand_id", ligne.brand_id)
    .eq("platform", "facebook")
    .single();
  if (!compte) redirect("/journal?err=Page%20Facebook%20non%20connect%C3%A9e");

  try {
    const jeton = dechiffrer(String(compte.encrypted_credentials));
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${ligne.remote_id}?access_token=${encodeURIComponent(jeton)}`,
      { method: "DELETE", cache: "no-store" }
    );
    const json = await r.json();
    if (!r.ok || json.error) throw new Error(json?.error?.message ?? "suppression refusée");
    await supabase.from("publication_log").update({ status: "cancelled" }).eq("id", id);
  } catch (e) {
    redirect(`/journal?err=${encodeURIComponent(e instanceof Error ? e.message : "suppression impossible")}`);
  }

  revalidatePath("/journal");
  redirect("/journal?ok=Publication%20supprim%C3%A9e%20de%20la%20Page");
}

/** Active ou coupe le rendez-vous hebdomadaire du dimanche. */
export async function basculerHebdo(formData: FormData) {
  const supabase = await supabaseServer();
  const actif = String(formData.get("actif") ?? "false") === "true";
  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect("/journal?err=Marque%20introuvable");

  const { error } = await supabase
    .from("story_auto")
    .upsert({ brand_id: brandId, enabled: !actif }, { onConflict: "brand_id" });
  if (error) redirect(`/journal?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/journal");
  redirect(`/journal?ok=${actif ? "Publication%20automatique%20coup%C3%A9e" : "Publication%20automatique%20activ%C3%A9e"}`);
}
