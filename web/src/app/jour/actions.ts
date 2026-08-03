"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { iso } from "@/lib/semaine";
import { publierLaJournee } from "@/lib/publier-jour";

/** Date d'aujourd'hui à Paris, au format AAAA-MM-JJ. */
function aujourdhuiParis(): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
}

export async function publierStoryDuJour(formData: FormData) {
  const media = (formData.get("media") as string) || null;
  const theme = String(formData.get("theme") ?? "vert");
  const meteo = String(formData.get("meteo") ?? "");
  const cibles = [
    formData.get("instagram") === "on" ? "instagram" : null,
    formData.get("facebook") === "on" ? "facebook" : null,
  ].filter(Boolean) as string[];
  const retour = (p: string) => redirect(`/jour?${p}`);
  if (!cibles.length) retour("err=Choisissez%20au%20moins%20un%20r%C3%A9seau");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) retour("err=Marque%20introuvable");

  try {
    const resultats = await publierLaJournee(supabase, {
      brandId: brandId!,
      jour: aujourdhuiParis(),
      theme,
      mediaPath: media,
      cibles,
      meteo: meteo || undefined,
    });
    revalidatePath("/jour");
    revalidatePath("/journal");
    const echecs = resultats.filter((r) => r.status === "failed");
    if (echecs.length) retour(`err=${encodeURIComponent(echecs.map((e) => `${e.platform} : ${e.error}`).join(" · "))}`);
    retour(`ok=${encodeURIComponent(`Story du jour publiée sur ${resultats.map((r) => r.platform).join(" et ")}`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "publication impossible")}`);
  }
}

/** Active ou coupe la story automatique du matin. */
export async function basculerJourAuto(formData: FormData) {
  const supabase = await supabaseServer();
  const actif = String(formData.get("actif") ?? "false") === "true";
  const heure = Math.max(5, Math.min(14, parseInt(String(formData.get("heure") ?? "9"), 10) || 9));
  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect("/jour?err=Marque%20introuvable");

  const { error } = await supabase
    .from("story_auto")
    .upsert(
      { brand_id: brandId, jour_enabled: !actif, jour_hour_paris: heure },
      { onConflict: "brand_id" }
    );
  if (error) redirect(`/jour?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/jour");
  redirect(
    `/jour?ok=${actif ? "Story%20du%20matin%20coup%C3%A9e" : encodeURIComponent(`Story du matin activée à ${heure}h`)}`
  );
}

/** Signale une rupture depuis l'écran du matin, sans passer par Ma marque. */
export async function basculerRupture(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  const rupture = String(formData.get("rupture") ?? "false") === "true";
  if (id) await supabase.from("products").update({ out_of_stock: !rupture }).eq("id", id);
  revalidatePath("/jour");
  revalidatePath("/marque");
}
