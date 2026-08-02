"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function currentBrandId() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("brands").select("id").limit(1);
  if (error) return { supabase, brandId: null, error: error.message };
  return { supabase, brandId: data?.[0]?.id ?? null, error: null as string | null };
}

export async function addSlot(formData: FormData) {
  const { supabase, brandId, error } = await currentBrandId();
  if (error) redirect(`/emplacements?err=${encodeURIComponent(error)}`);
  if (!brandId) redirect("/emplacements?err=Aucune%20marque%20trouv%C3%A9e");

  const day = String(formData.get("day") ?? "");
  const service = String(formData.get("service") ?? "midi");
  const lieu = String(formData.get("lieu") ?? "").trim();
  const horaires = String(formData.get("horaires") ?? "").trim();
  if (!day || !lieu) redirect("/emplacements?err=Indiquez%20un%20lieu");

  const { error: insErr } = await supabase.from("location_schedule").insert({
    brand_id: brandId,
    day,
    service,
    time_range: horaires || (service === "midi" ? "11h30-14h" : "18h30-22h"),
    note: lieu,
  });
  if (insErr) redirect(`/emplacements?err=${encodeURIComponent(insErr.message)}`);
  revalidatePath("/emplacements");
}

export async function deleteSlot(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("location_schedule").delete().eq("id", id);
  if (error) redirect(`/emplacements?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/emplacements");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
