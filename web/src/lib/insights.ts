import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";

const GRAPH = "https://graph.facebook.com/v23.0";

export type Mesures = {
  // Instagram, tant que la story est en ligne
  vues?: number;
  portee?: number;
  reponses?: number;
  // Facebook, disponible durablement
  reactions?: number;
  clics?: number;
  indisponible?: string;
};

export type MesuresPage = {
  vuesPage?: number;
  interactions?: number;
  nouveauxAbonnes?: number;
  erreur?: string;
};

async function json(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j?.error?.message ?? `appel refusé (${r.status})`);
  return j;
}

type Serie = { name: string; values?: { value?: number | Record<string, number> }[] };

function valeur(data: Serie[], nom: string): number | undefined {
  const v = data.find((d) => d.name === nom)?.values?.[0]?.value;
  return typeof v === "number" ? v : undefined;
}

/** Certaines mesures renvoient un objet (réactions par type) : on additionne. */
function total(data: Serie[], nom: string): number | undefined {
  const v = data.find((d) => d.name === nom)?.values?.[0]?.value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object") return Object.values(v).reduce((s, n) => s + (n ?? 0), 0);
  return undefined;
}

/** Somme d'une série quotidienne sur toute la période renvoyée. */
function sommeSerie(data: Serie[], nom: string): number | undefined {
  const s = data.find((d) => d.name === nom);
  if (!s?.values) return undefined;
  return s.values.reduce((acc, p) => acc + (typeof p.value === "number" ? p.value : 0), 0);
}

/**
 * Meta a retiré les mesures d'impressions et de portée au niveau publication
 * (post_impressions, post_engaged_users et compagnie). Restent les réactions
 * et les clics, que l'on relève ici.
 */
export async function mesuresPublicationFacebook(postId: string, jeton: string): Promise<Mesures> {
  try {
    const j = await json(
      `${GRAPH}/${postId}/insights?metric=post_clicks,post_reactions_by_type_total&access_token=${encodeURIComponent(jeton)}`
    );
    const d = (j.data ?? []) as Serie[];
    return {
      clics: valeur(d, "post_clicks"),
      reactions: total(d, "post_reactions_by_type_total") ?? 0,
    };
  } catch (e) {
    return { indisponible: e instanceof Error ? e.message : "statistiques indisponibles" };
  }
}

/** Statistiques d'une story Instagram, valables tant qu'elle est en ligne. */
export async function mesuresStoryInstagram(mediaId: string, jeton: string): Promise<Mesures> {
  for (const jeu of ["views,reach,replies", "impressions,reach,replies"]) {
    try {
      const j = await json(`${GRAPH}/${mediaId}/insights?metric=${jeu}&access_token=${encodeURIComponent(jeton)}`);
      const d = (j.data ?? []) as Serie[];
      if (d.length) {
        return {
          vues: valeur(d, "views") ?? valeur(d, "impressions"),
          portee: valeur(d, "reach"),
          reponses: valeur(d, "replies"),
        };
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m.includes("does not exist")) {
        return { indisponible: "story terminée : Instagram ne conserve pas ses statistiques" };
      }
    }
  }
  return { indisponible: "statistiques Instagram indisponibles" };
}

/** Vue d'ensemble de la Page sur les trente derniers jours. */
export async function mesuresPage(pageId: string, jeton: string): Promise<MesuresPage> {
  try {
    const j = await json(
      `${GRAPH}/${pageId}/insights?metric=page_views_total,page_post_engagements,page_daily_follows_unique&period=day&date_preset=last_30d&access_token=${encodeURIComponent(jeton)}`
    );
    const d = (j.data ?? []) as Serie[];
    return {
      vuesPage: sommeSerie(d, "page_views_total"),
      interactions: sommeSerie(d, "page_post_engagements"),
      nouveauxAbonnes: sommeSerie(d, "page_daily_follows_unique"),
    };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "statistiques de Page indisponibles" };
  }
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
