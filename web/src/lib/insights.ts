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

/**
 * Meta renomme et retire des métriques d'une version à l'autre. Plutôt que de
 * tout perdre sur un nom invalide, on essaie plusieurs jeux, puis chaque
 * métrique séparément, et on garde ce qui répond.
 */
async function essayerMetriques(
  base: string,
  jeton: string,
  jeux: string[][]
): Promise<{ data: { name: string; values?: { value?: number }[] }[]; erreur?: string }> {
  let derniere = "";
  for (const jeu of jeux) {
    try {
      const j = await json(
        `${GRAPH}/${base}/insights?metric=${jeu.join(",")}&access_token=${encodeURIComponent(jeton)}`
      );
      if (j.data?.length) return { data: j.data };
    } catch (e) {
      derniere = e instanceof Error ? e.message : "appel refusé";
    }
  }
  // dernier recours : une métrique à la fois
  const toutes = [...new Set(jeux.flat())];
  const data: { name: string; values?: { value?: number }[] }[] = [];
  for (const m of toutes) {
    try {
      const j = await json(`${GRAPH}/${base}/insights?metric=${m}&access_token=${encodeURIComponent(jeton)}`);
      if (j.data?.length) data.push(...j.data);
    } catch (e) {
      derniere = e instanceof Error ? e.message : derniere;
    }
  }
  return { data, erreur: data.length ? undefined : derniere };
}

/** Statistiques d'une story Instagram (valables tant que la story est en ligne). */
export async function mesuresStoryInstagram(mediaId: string, jeton: string): Promise<Mesures> {
  const { data, erreur } = await essayerMetriques(mediaId, jeton, [
    ["views", "reach", "replies"],
    ["impressions", "reach", "replies"],
  ]);
  if (erreur) return { indisponible: erreur };
  return {
    vues: somme(data, "views") ?? somme(data, "impressions"),
    portee: somme(data, "reach"),
    reponses: somme(data, "replies"),
  };
}

/** Statistiques d'une publication de Page Facebook. */
export async function mesuresPublicationFacebook(idPublication: string, jeton: string): Promise<Mesures> {
  const mesures: Mesures = {};

  // Une photo publiée renvoie parfois l'identifiant de la photo et non celui de
  // la publication : les statistiques ne vivent que sur la publication.
  let postId = idPublication;
  let noteResolution = "";
  if (!postId.includes("_")) {
    try {
      const j = await json(
        `${GRAPH}/${idPublication}?fields=page_story_id&access_token=${encodeURIComponent(jeton)}`
      );
      if (j?.page_story_id) postId = String(j.page_story_id);
      else noteResolution = "publication liée à la photo introuvable";
    } catch (e) {
      noteResolution = e instanceof Error ? e.message : "résolution impossible";
    }
  }

  const { data, erreur } = await essayerMetriques(postId, jeton, [
    ["post_impressions", "post_impressions_unique", "post_engaged_users"],
    ["post_impressions", "post_impressions_unique"],
    ["post_views", "post_reach"],
  ]);
  if (erreur) mesures.indisponible = [noteResolution, erreur].filter(Boolean).join(" · ");
  mesures.vues = somme(data, "post_impressions") ?? somme(data, "post_views");
  mesures.portee = somme(data, "post_impressions_unique") ?? somme(data, "post_reach");
  mesures.interactions = somme(data, "post_engaged_users");
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
