import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export type Mesures = {
  vues?: number;
  portee?: number;
  interactions?: number;
  reponses?: number;
  jaime?: number;
  commentaires?: number;
  partages?: number;
  indisponible?: string;
};

async function json(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `appel refusé (${r.status})`);
  return j;
}

function somme(data: { name: string; values?: { value?: number }[] }[], nom: string): number | undefined {
  const m = data.find((d) => d.name === nom);
  const v = m?.values?.[0]?.value;
  return typeof v === "number" ? v : undefined;
}

/** Statistiques d'une story Instagram (valables tant que la story est en ligne). */
export async function mesuresStoryInstagram(mediaId: string, jeton: string): Promise<Mesures> {
  // Meta a renommé « impressions » en « views » selon les versions : on tente
  // le jeu récent, puis l'ancien, plutôt que d'échouer sur un nom de métrique.
  for (const metriques of ["views,reach,replies", "impressions,reach,replies"]) {
    try {
      const j = await json(
        `${GRAPH}/${mediaId}/insights?metric=${metriques}&access_token=${encodeURIComponent(jeton)}`
      );
      const d = j.data ?? [];
      return {
        vues: somme(d, "views") ?? somme(d, "impressions"),
        portee: somme(d, "reach"),
        reponses: somme(d, "replies"),
      };
    } catch {
      // on essaie le jeu de métriques suivant
    }
  }
  return { indisponible: "statistiques Instagram indisponibles (story expirée ou autorisation manquante)" };
}

/** Statistiques d'une publication de Page Facebook. */
export async function mesuresPublicationFacebook(postId: string, jeton: string): Promise<Mesures> {
  const mesures: Mesures = {};
  try {
    const j = await json(
      `${GRAPH}/${postId}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users&access_token=${encodeURIComponent(jeton)}`
    );
    const d = j.data ?? [];
    mesures.vues = somme(d, "post_impressions");
    mesures.portee = somme(d, "post_impressions_unique");
    mesures.interactions = somme(d, "post_engaged_users");
  } catch (e) {
    mesures.indisponible = e instanceof Error ? e.message : "statistiques indisponibles";
  }
  try {
    const j = await json(
      `${GRAPH}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${encodeURIComponent(jeton)}`
    );
    mesures.jaime = j?.likes?.summary?.total_count;
    mesures.commentaires = j?.comments?.summary?.total_count;
    mesures.partages = j?.shares?.count ?? 0;
  } catch {
    // les compteurs publics restent facultatifs
  }
  return mesures;
}

/**
 * Rafraîchit les statistiques des publications récentes d'une marque.
 * Appelé par la tâche planifiée et par le bouton « actualiser ».
 */
export async function rafraichirMesures(supabase: SupabaseClient, brandId: string, depuisJours = 4) {
  const depuis = new Date(Date.now() - depuisJours * 86_400_000).toISOString();
  const { data: lignes } = await supabase
    .from("publication_log")
    .select("id, platform, remote_id, created_at")
    .eq("brand_id", brandId)
    .eq("status", "published")
    .gte("created_at", depuis)
    .not("remote_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!lignes?.length) return 0;

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, encrypted_credentials")
    .eq("brand_id", brandId);
  const jeton = (p: string) => {
    const c = (comptes ?? []).find((x) => x.platform === p);
    return c ? dechiffrer(String(c.encrypted_credentials)) : null;
  };
  const jetonIg = jeton("instagram");
  const jetonFb = jeton("facebook");

  let comptees = 0;
  for (const l of lignes) {
    const t = l.platform === "instagram" ? jetonIg : jetonFb;
    if (!t) continue;
    const m =
      l.platform === "instagram"
        ? await mesuresStoryInstagram(String(l.remote_id), t)
        : await mesuresPublicationFacebook(String(l.remote_id), t);
    await supabase
      .from("publication_log")
      .update({ metrics: m, metrics_at: new Date().toISOString() })
      .eq("id", l.id);
    comptees++;
  }
  return comptees;
}
