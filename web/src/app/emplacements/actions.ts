"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function addSlot(formData: FormData) {
  const supabase = await supabaseServer();
  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id;
  if (!brandId) return;

  const day = String(formData.get("day") ?? "");
  const service = String(formData.get("service") ?? "midi");
  const lieu = String(formData.get("lieu") ?? "").trim();
  const horaires = String(formData.get("horaires") ?? "").trim();
  if (!day || !lieu) return;

  await supabase.from("location_schedule").insert({
    brand_id: brandId,
    day,
    service,
    time_range: horaires || (service === "midi" ? "11h30-14h" : "18h30-22h"),
    note: lieu, // le lieu saisi librement (table locations utilisée plus tard pour les lieux enregistrés)
  });
  revalidatePath("/emplacements");
}

export async function deleteSlot(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("location_schedule").delete().eq("id", id);
  revalidatePath("/emplacements");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}
