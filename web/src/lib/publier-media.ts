import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";
import { publierPhotoFacebook, publierPhotoInstagram, publierStoryInstagram } from "./meta";
import type { Resultat } from "./publish";

/**
 * Publie une photo déjà déposée dans le stockage : une proposition du studio
 * accompagnée de sa légende, en story ou dans le fil.
 */
export async function publierMedia(
  supabase: SupabaseClient,
  opts: {
    brandId: string;
    mediaPath: string;
    legende: string;
    cibles: string[];
    format: string; // story ou post
  }
): Promise<Resultat[]> {
  const { brandId, mediaPath, legende, cibles, format } = opts;

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, external_id, encrypted_credentials")
    .eq("brand_id", brandId);
  const compte = (p: string) => (comptes ?? []).find((c) => c.platform === p);

  const url = supabase.storage.from("media").getPublicUrl(mediaPath).data.publicUrl;
  const resultats: Resultat[] = [];

  if (cibles.includes("instagram")) {
    const ig = compte("instagram");
    if (!ig) resultats.push({ platform: "instagram", status: "failed", error: "compte non connecté" });
    else
      try {
        const jeton = dechiffrer(String(ig.encrypted_credentials));
        const id =
          format === "story"
            ? await publierStoryInstagram(String(ig.external_id), jeton, url)
            : await publierPhotoInstagram(String(ig.external_id), jeton, url, legende);
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
          legende
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
      kind: format === "story" ? "story" : "post",
      status: r.status,
      remote_id: r.remote_id ?? null,
      caption: legende || null,
      media_url: url,
      error: r.error ?? null,
    }))
  );

  return resultats;
}
