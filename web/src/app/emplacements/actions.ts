"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, mondayOf } from "@/lib/semaine";

async function currentBrandId() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("brands").select("id").limit(1);
  if (error) return { supabase, brandId: null, error: error.message };
  return { supabase, brandId: data?.[0]?.id ?? null, error: null as string | null };
}

function retour(w: number, params = ""): string {
  const base = w === 0 ? "/emplacements" : `/emplacements?w=${w}`;
  if (!params) return base;
  return base + (base.includes("?") ? "&" : "?") + params;
}

export async function addSlot(formData: FormData) {
  const w = clampWeek(formData.get("w"));
  const { supabase, brandId, error } = await currentBrandId();
  if (error) redirect(retour(w, `err=${encodeURIComponent(error)}`));
  if (!brandId) redirect(retour(w, "err=Aucune%20marque%20trouv%C3%A9e"));

  const day = String(formData.get("day") ?? "");
  const service = String(formData.get("service") ?? "midi");
  const lieu = String(formData.get("lieu") ?? "").trim();
  const horaires = String(formData.get("horaires") ?? "").trim();
  if (!day || !lieu) redirect(retour(w, "err=Indiquez%20un%20lieu"));

  const { error: insErr } = await supabase.from("location_schedule").insert({
    brand_id: brandId,
    day,
    service,
    time_range: horaires || (service === "midi" ? "11h30-14h" : "18h30-22h"),
    note: lieu,
  });
  if (insErr) redirect(retour(w, `err=${encodeURIComponent(insErr.message)}`));
  revalidatePath("/emplacements");
  revalidatePath("/semaine");
}

export async function deleteSlot(formData: FormData) {
  const w = clampWeek(formData.get("w"));
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("location_schedule").delete().eq("id", id);
  if (error) redirect(retour(w, `err=${encodeURIComponent(error.message)}`));
  revalidatePath("/emplacements");
  revalidatePath("/semaine");
}

/** Recopie les emplacements de la semaine précédente sur la semaine affichée. */
export async function copyPreviousWeek(formData: FormData) {
  const w = clampWeek(formData.get("w"));
  const { supabase, brandId, error } = await currentBrandId();
  if (error) redirect(retour(w, `err=${encodeURIComponent(error)}`));
  if (!brandId) redirect(retour(w, "err=Aucune%20marque%20trouv%C3%A9e"));

  const cible = mondayOf(w);
  const source = mondayOf(w - 1);
  const sourceFin = new Date(source);
  sourceFin.setUTCDate(sourceFin.getUTCDate() + 6);

  const { data: precedents, error: readErr } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .gte("day", iso(source))
    .lte("day", iso(sourceFin));
  if (readErr) redirect(retour(w, `err=${encodeURIComponent(readErr.message)}`));
  if (!precedents?.length) redirect(retour(w, "err=La%20semaine%20pr%C3%A9c%C3%A9dente%20est%20vide"));

  const cibleFin = new Date(cible);
  cibleFin.setUTCDate(cibleFin.getUTCDate() + 6);
  const { data: deja } = await supabase
    .from("location_schedule")
    .select("day, service")
    .gte("day", iso(cible))
    .lte("day", iso(cibleFin));
  const occupes = new Set((deja ?? []).map((s) => `${s.day}|${s.service}`));

  const lignes = precedents
    .map((s) => {
      const d = new Date(s.day + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 7);
      return { day: iso(d), service: s.service, time_range: s.time_range, note: s.note };
    })
    .filter((s) => !occupes.has(`${s.day}|${s.service}`))
    .map((s) => ({ ...s, brand_id: brandId }));

  if (lignes.length) {
    const { error: insErr } = await supabase.from("location_schedule").insert(lignes);
    if (insErr) redirect(retour(w, `err=${encodeURIComponent(insErr.message)}`));
  }
  revalidatePath("/emplacements");
  revalidatePath("/semaine");
  redirect(retour(w, `ok=${lignes.length}%20emplacement${lignes.length > 1 ? "s" : ""}%20repris`));
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Journée annulée : marque les services du jour comme annulés et retire les
 * envois programmés pour cette journée. Utile un jour de pluie ou de panne.
 */
export async function annulerJournee(formData: FormData) {
  const supabase = await supabaseServer();
  const jour = String(formData.get("day") ?? "");
  const w = clampWeek(formData.get("w"));
  if (!jour) return;

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect(retour(w, "err=Marque%20introuvable"));

  const { error } = await supabase
    .from("location_schedule")
    .update({ status: "cancelled" })
    .eq("brand_id", brandId)
    .eq("day", jour);
  if (error) redirect(retour(w, `err=${encodeURIComponent(error.message)}`));

  // Les envois prévus ce jour-là n'ont plus lieu d'être
  const debut = new Date(jour + "T00:00:00Z").toISOString();
  const fin = new Date(jour + "T23:59:59Z").toISOString();
  await supabase
    .from("story_jobs")
    .update({ status: "cancelled", done_at: new Date().toISOString() })
    .eq("brand_id", brandId)
    .eq("status", "scheduled")
    .gte("run_at", debut)
    .lte("run_at", fin);

  revalidatePath("/emplacements");
  revalidatePath("/journal");
  redirect(retour(w, "ok=Journ%C3%A9e%20annul%C3%A9e"));
}

/** Retour en arrière : la journée est finalement assurée. */
export async function retablirJournee(formData: FormData) {
  const supabase = await supabaseServer();
  const jour = String(formData.get("day") ?? "");
  const w = clampWeek(formData.get("w"));
  if (!jour) return;
  await supabase.from("location_schedule").update({ status: "planned" }).eq("day", jour);
  revalidatePath("/emplacements");
  redirect(retour(w, "ok=Journ%C3%A9e%20r%C3%A9tablie"));
}
