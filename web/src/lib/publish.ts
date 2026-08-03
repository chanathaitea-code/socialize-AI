import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";
import { iso, libellePeriode } from "./semaine";
import { THEMES, legendeJours, lignesSemaine, type Slot } from "./story";
import { rendreStory } from "./story-render";
import { publierPhotoFacebook, publierStoryInstagram } from "./meta";

export type Resultat = { platform: string; status: "published" | "failed"; remote_id?: string; error?: string };

/**
 * Fabrique l'image de la story, la dépose dans le stockage public (l'API de
 * Meta ne publie qu'à partir d'une URL qu'elle peut lire), puis publie sur les
 * réseaux demandés. Chaque envoi est journalisé, réussite comme échec.
 *
 * Utilisé aussi bien par le bouton « publier » que par la tâche planifiée :
 * le client Supabase est passé en paramètre pour couvrir les deux cas.
 */
export async function publierLaStory(
  supabase: SupabaseClient,
  opts: {
    brandId: string;
    monday: Date;
    theme: string;
    mediaPath: string | null;
    fond: string | null;
    legende: string;
    cibles: string[];
  }
): Promise<Resultat[]> {
  const { brandId, monday, theme, mediaPath, fond, legende, cibles } = opts;

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, external_id, encrypted_credentials")
    .eq("brand_id", brandId);
  const compte = (p: string) => (comptes ?? []).find((c) => c.platform === p);

  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const { data: slots } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .eq("brand_id", brandId)
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day")
    .order("service");

  const lignes = lignesSemaine((slots ?? []) as Slot[], monday);
  const periode = libellePeriode(monday);

  // Envoi automatique : personne n'a rédigé de légende, on la compose
  const texte =
    legende ||
    `📍 Retrouvez notre food truck ${periode} ! ` +
      (legendeJours(lignes) ? `${legendeJours(lignes)}. ` : "") +
      "On vous attend au camion 🍜\n\n#foodtruck #thai #chanathai #essonne #yvelines";

  const photoUrl = mediaPath ? supabase.storage.from("media").getPublicUrl(mediaPath).data.publicUrl : null;
  const image = await rendreStory({
    theme: THEMES[theme] ?? THEMES.vert,
    lignes,
    periode,
    photoUrl,
    fond,
  });
  const png = Buffer.from(await image.arrayBuffer());

  const chemin = `${brandId}/stories/${iso(monday)}-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(chemin, png, { contentType: "image/png", upsert: false });
  if (upErr) throw new Error(`dépôt de l'image impossible : ${upErr.message}`);
  const url = supabase.storage.from("media").getPublicUrl(chemin).data.publicUrl;

  const resultats: Resultat[] = [];

  if (cibles.includes("instagram")) {
    const ig = compte("instagram");
    if (!ig) resultats.push({ platform: "instagram", status: "failed", error: "compte non connecté" });
    else
      try {
        const id = await publierStoryInstagram(
          String(ig.external_id),
          dechiffrer(String(ig.encrypted_credentials)),
          url
        );
        resultats.push({ platform: "instagram", status: "published", remote_id: id });
      } catch (e) {
        resultats.push({ platform: "instagram", status: "failed", error: e instanceof Error ? e.message : "échec" });
      }
  }

  if (cibles.includes("facebook")) {
    const fb = compte("facebook");
    if (!fb) resultats.push({ platform: "facebook", status: "failed", error: "Page non connectée" });
    else
      try {
        const id = await publierPhotoFacebook(
          String(fb.external_id),
          dechiffrer(String(fb.encrypted_credentials)),
          url,
          texte
        );
        resultats.push({ platform: "facebook", status: "published", remote_id: id });
      } catch (e) {
        resultats.push({ platform: "facebook", status: "failed", error: e instanceof Error ? e.message : "échec" });
      }
  }

  await supabase.from("publication_log").insert(
    resultats.map((r) => ({
      brand_id: brandId,
      platform: r.platform,
      kind: "story",
      status: r.status,
      remote_id: r.remote_id ?? null,
      caption: texte,
      media_url: url,
      error: r.error ?? null,
    }))
  );

  return resultats;
}
