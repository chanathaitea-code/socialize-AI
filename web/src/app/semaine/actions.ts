"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, mondayOf } from "@/lib/semaine";
import { publierLaStory } from "@/lib/publish";

/**
 * L'envoi de la photo se fait depuis le navigateur, directement vers le
 * stockage Supabase (voir photo-uploader.tsx) : passer par le serveur imposait
 * une limite de 4,5 Mo par requête que toute photo de téléphone dépassait.
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

function lienRetour(theme: string, w: number, media: string | null, fond: string | null, params: string) {
  let u = `/semaine?theme=${theme}`;
  if (w === 1) u += "&s=next";
  if (media) u += `&media=${encodeURIComponent(media)}`;
  else if (fond) u += `&fond=${fond}`;
  return `${u}&${params}`;
}

const REDIRECT = "NEXT_REDIRECT";
function estRedirection(e: unknown) {
  return !!e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith(REDIRECT);
}

/**
 * Publie la story, tout de suite ou après un délai de grâce pendant lequel
 * l'envoi reste annulable depuis le journal.
 */
export async function publierStory(formData: FormData) {
  const theme = String(formData.get("theme") ?? "vert");
  const w = clampWeek(formData.get("w"));
  const media = (formData.get("media") as string) || null;
  const fond = (formData.get("fond") as string) || null;
  const legende = String(formData.get("legende") ?? "").trim();
  const delai = Math.max(0, Math.min(120, parseInt(String(formData.get("delai") ?? "10"), 10) || 0));
  const cibles = [
    formData.get("instagram") === "on" ? "instagram" : null,
    formData.get("facebook") === "on" ? "facebook" : null,
  ].filter(Boolean) as string[];

  const retour = (p: string) => redirect(lienRetour(theme, w, media, fond, p));
  if (!cibles.length) retour("err=Choisissez%20au%20moins%20un%20r%C3%A9seau");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) retour("err=Marque%20introuvable");

  const monday = mondayOf(w);

  // Envoi différé : on enregistre un rendez-vous, la tâche planifiée s'en charge
  if (delai > 0) {
    const { error } = await supabase.from("story_jobs").insert({
      brand_id: brandId,
      run_at: new Date(Date.now() + delai * 60_000).toISOString(),
      monday: iso(monday),
      theme,
      media_path: media,
      fond,
      caption: legende,
      targets: cibles,
      origin: "manuel",
    });
    if (error) retour(`err=${encodeURIComponent(error.message)}`);
    revalidatePath("/journal");
    retour(`ok=${encodeURIComponent(`Envoi programmé dans ${delai} minutes, annulable depuis le journal`)}`);
  }

  try {
    const resultats = await publierLaStory(supabase, {
      brandId: brandId!,
      monday,
      theme,
      mediaPath: media,
      fond,
      legende,
      cibles,
    });
    revalidatePath("/journal");
    const echecs = resultats.filter((r) => r.status === "failed");
    if (echecs.length) {
      retour(`err=${encodeURIComponent(echecs.map((e) => `${e.platform} : ${e.error}`).join(" · "))}`);
    }
    retour(`ok=${encodeURIComponent(`Publié sur ${resultats.map((r) => r.platform).join(" et ")}`)}`);
  } catch (e) {
    if (estRedirection(e)) throw e;
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "publication impossible")}`);
  }
}
