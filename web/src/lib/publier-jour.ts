import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";
import { JOURS, MOIS, iso } from "./semaine";
import { unTheme } from "./design";
import { jourImageElement } from "./jour-image";
import { rendreElement } from "./story-render";
import { publierPhotoFacebook, publierStoryInstagram } from "./meta";
import type { Resultat } from "./publish";

/**
 * La story « on est là aujourd'hui » : construite depuis les services du jour,
 * publiée en story Instagram et, si demandé, en photo sur la Page.
 * Partagée par le bouton de l'écran du matin et par la tâche planifiée.
 */
export async function publierLaJournee(
  supabase: SupabaseClient,
  opts: { brandId: string; jour: Date; theme?: string; mediaPath?: string | null; cibles: string[]; meteo?: string }
): Promise<Resultat[]> {
  const { brandId, jour, theme = "vert", mediaPath = null, cibles, meteo } = opts;

  const { data: slots } = await supabase
    .from("location_schedule")
    .select("service, time_range, note, status")
    .eq("brand_id", brandId)
    .eq("day", iso(jour))
    .neq("status", "cancelled")
    .order("service");

  const services = (slots ?? []).map((s) => ({
    label: s.service === "midi" ? "MIDI" : "SOIR",
    lieu: s.note ?? "",
    horaires: s.time_range ?? "",
  }));

  const indice = (jour.getUTCDay() + 6) % 7;
  const image = await rendreElement(
    jourImageElement({
      theme: await unTheme(supabase, brandId, theme),
      jourLong: JOURS[indice],
      dateCourte: `${jour.getUTCDate()} ${MOIS[jour.getUTCMonth()]}`,
      services,
      photoUrl: mediaPath ? supabase.storage.from("media").getPublicUrl(mediaPath).data.publicUrl : null,
      meteo,
    })
  );
  const png = Buffer.from(await image.arrayBuffer());

  const chemin = `${brandId}/jour/${iso(jour)}-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(chemin, png, { contentType: "image/png", upsert: false });
  if (upErr) throw new Error(upErr.message);
  const url = supabase.storage.from("media").getPublicUrl(chemin).data.publicUrl;

  const legende =
    services.length === 0
      ? "Le camion se repose aujourd'hui, on recharge les woks 🍜"
      : `📍 Aujourd'hui, ${services
          .map((s) => `${s.label.toLowerCase()} ${s.lieu} (${s.horaires})`)
          .join(" et ")}. On vous attend 🍜`;

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, external_id, encrypted_credentials")
    .eq("brand_id", brandId);

  const resultats: Resultat[] = [];
  for (const cible of cibles) {
    const c = (comptes ?? []).find((x) => x.platform === cible);
    if (!c) {
      resultats.push({ platform: cible, status: "failed", error: "compte non connecté" });
      continue;
    }
    try {
      const jeton = dechiffrer(String(c.encrypted_credentials));
      const id =
        cible === "instagram"
          ? await publierStoryInstagram(String(c.external_id), jeton, url)
          : await publierPhotoFacebook(String(c.external_id), jeton, url, legende);
      resultats.push({ platform: cible, status: "published", remote_id: id });
    } catch (e) {
      resultats.push({ platform: cible, status: "failed", error: e instanceof Error ? e.message : "échec" });
    }
  }

  await supabase.from("publication_log").insert(
    resultats.map((r) => ({
      brand_id: brandId,
      platform: r.platform,
      kind: "jour",
      status: r.status,
      remote_id: r.remote_id ?? null,
      caption: legende,
      media_url: url,
      error: r.error ?? null,
    }))
  );

  return resultats;
}
