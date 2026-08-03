"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { dechiffrer } from "@/lib/crypto";
import { clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import { THEMES, lignesSemaine, type Slot } from "@/lib/story";
import { rendreStory } from "@/lib/story-render";
import { publierPhotoFacebook, publierStoryInstagram } from "@/lib/meta";

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

/**
 * Publie la story sur les réseaux cochés. L'image est d'abord déposée dans le
 * stockage public : l'API de Meta ne sait publier qu'à partir d'une URL
 * accessible depuis ses serveurs.
 */
export async function publierStory(formData: FormData) {
  const theme = String(formData.get("theme") ?? "vert");
  const w = clampWeek(formData.get("w"));
  const media = (formData.get("media") as string) || null;
  const fond = (formData.get("fond") as string) || null;
  const legende = String(formData.get("legende") ?? "").trim();
  const surInstagram = formData.get("instagram") === "on";
  const surFacebook = formData.get("facebook") === "on";
  const retour = (p: string) => redirect(lienRetour(theme, w, media, fond, p));

  if (!surInstagram && !surFacebook) retour("err=Choisissez%20au%20moins%20un%20r%C3%A9seau");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) retour("err=Marque%20introuvable");

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, external_id, encrypted_credentials, details");
  const instagram = comptes?.find((c) => c.platform === "instagram");
  const facebook = comptes?.find((c) => c.platform === "facebook");
  if (surInstagram && !instagram) retour("err=Instagram%20non%20connect%C3%A9");
  if (surFacebook && !facebook) retour("err=Page%20Facebook%20non%20connect%C3%A9e");

  try {
    // 1. Construire l'image de la semaine affichée
    const monday = mondayOf(w);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const { data: slots } = await supabase
      .from("location_schedule")
      .select("day, service, time_range, note")
      .gte("day", iso(monday))
      .lte("day", iso(sunday))
      .order("day")
      .order("service");

    const photoUrl = media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null;
    const image = await rendreStory({
      theme: THEMES[theme] ?? THEMES.vert,
      lignes: lignesSemaine((slots ?? []) as Slot[], monday),
      periode: libellePeriode(monday),
      photoUrl,
      fond,
    });
    const png = Buffer.from(await image.arrayBuffer());

    // 2. Déposer l'image dans le stockage public
    const chemin = `${brandId}/stories/${iso(monday)}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(chemin, png, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`dépôt de l'image impossible : ${upErr.message}`);
    const url = supabase.storage.from("media").getPublicUrl(chemin).data.publicUrl;

    // 3. Publier, réseau par réseau, en journalisant chaque résultat
    const journal: { platform: string; status: string; remote_id?: string; error?: string }[] = [];

    if (surInstagram && instagram) {
      try {
        const id = await publierStoryInstagram(
          String(instagram.external_id),
          dechiffrer(String(instagram.encrypted_credentials)),
          url
        );
        journal.push({ platform: "instagram", status: "published", remote_id: id });
      } catch (e) {
        journal.push({ platform: "instagram", status: "failed", error: e instanceof Error ? e.message : "échec" });
      }
    }

    if (surFacebook && facebook) {
      try {
        const id = await publierPhotoFacebook(
          String(facebook.external_id),
          dechiffrer(String(facebook.encrypted_credentials)),
          url,
          legende
        );
        journal.push({ platform: "facebook", status: "published", remote_id: id });
      } catch (e) {
        journal.push({ platform: "facebook", status: "failed", error: e instanceof Error ? e.message : "échec" });
      }
    }

    await supabase.from("publication_log").insert(
      journal.map((j) => ({
        brand_id: brandId,
        platform: j.platform,
        kind: "story",
        status: j.status,
        remote_id: j.remote_id ?? null,
        caption: legende || null,
        media_url: url,
        error: j.error ?? null,
      }))
    );

    revalidatePath("/semaine");
    const echecs = journal.filter((j) => j.status === "failed");
    if (echecs.length) {
      retour(`err=${encodeURIComponent(echecs.map((e) => `${e.platform} : ${e.error}`).join(" · "))}`);
    }
    retour(`ok=${encodeURIComponent(`Publié sur ${journal.map((j) => j.platform).join(" et ")}`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "publication impossible")}`);
  }
}
