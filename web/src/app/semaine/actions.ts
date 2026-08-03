"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * L'envoi de la photo se fait désormais depuis le navigateur, directement vers
 * le stockage Supabase (voir photo-uploader.tsx) : passer par le serveur
 * imposait une limite de 4,5 Mo par requête que toute photo de téléphone
 * dépassait. Il ne reste ici que la suppression, qui ne transporte qu'un chemin.
 */
export async function deletePhoto(formData: FormData) {
  const supabase = await supabaseServer();
  const path = String(formData.get("path") ?? "");
  if (!path) return;
  await supabase.storage.from("media").remove([path]);
  await supabase.from("media_assets").delete().eq("storage_path", path);
  revalidatePath("/semaine");
  redirect("/semaine");
}
