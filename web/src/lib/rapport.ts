import type { SupabaseClient } from "@supabase/supabase-js";
import { dechiffrer } from "./crypto";
import { MOIS } from "./semaine";
import { mesuresPage } from "./insights";
import { redigerJson } from "./ia";

export type Rapport = {
  mois: string; // AAAA-MM-01
  intitule: string; // « juillet 2026 »
  publications: number;
  parReseau: Record<string, number>;
  echecs: number;
  services: number;
  vuesPage?: number;
  interactions?: number;
  nouveauxAbonnes?: number;
  meilleure?: { legende: string; reseau: string; score: number };
  lecture?: string;
  recommandations?: string[];
};

/** Premier jour du mois, en heure de Paris. */
export function premierDuMois(decalageMois = 0): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  const d = new Date(`${p.year}-${p.month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + decalageMois);
  return d;
}

const jourIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Construit le rapport d'un mois : ce qui est parti, ce que ça a donné, et
 * trois recommandations écrites à partir des chiffres réels.
 */
export async function construireRapport(
  supabase: SupabaseClient,
  brandId: string,
  mois: Date
): Promise<Rapport> {
  const finMois = new Date(mois);
  finMois.setUTCMonth(finMois.getUTCMonth() + 1);

  const { data: pubs } = await supabase
    .from("publication_log")
    .select("platform, status, caption, metrics, created_at")
    .eq("brand_id", brandId)
    .gte("created_at", mois.toISOString())
    .lt("created_at", finMois.toISOString());

  const publiees = (pubs ?? []).filter((p) => p.status === "published");
  const parReseau: Record<string, number> = {};
  for (const p of publiees) parReseau[p.platform] = (parReseau[p.platform] ?? 0) + 1;

  const score = (m: Record<string, number> | null) =>
    (m?.vues ?? 0) + (m?.portee ?? 0) + (m?.reactions ?? 0) * 10 + (m?.clics ?? 0) * 5 + (m?.reponses ?? 0) * 10;
  const meilleure = publiees
    .map((p) => ({
      legende: (p.caption ?? "").slice(0, 160),
      reseau: p.platform,
      score: score(p.metrics as Record<string, number> | null),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const { count: services } = await supabase
    .from("location_schedule")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .neq("status", "cancelled")
    .gte("day", jourIso(mois))
    .lt("day", jourIso(finMois));

  let page: Awaited<ReturnType<typeof mesuresPage>> = {};
  const { data: fb } = await supabase
    .from("social_accounts")
    .select("external_id, encrypted_credentials")
    .eq("brand_id", brandId)
    .eq("platform", "facebook")
    .maybeSingle();
  if (fb) {
    try {
      page = await mesuresPage(String(fb.external_id), dechiffrer(String(fb.encrypted_credentials)));
    } catch {
      // les statistiques de Page restent facultatives
    }
  }

  const rapport: Rapport = {
    mois: jourIso(mois),
    intitule: `${MOIS[mois.getUTCMonth()]} ${mois.getUTCFullYear()}`,
    publications: publiees.length,
    parReseau,
    echecs: (pubs ?? []).filter((p) => p.status === "failed").length,
    services: services ?? 0,
    vuesPage: page.vuesPage,
    interactions: page.interactions,
    nouveauxAbonnes: page.nouveauxAbonnes,
    meilleure: meilleure && meilleure.score > 0 ? meilleure : undefined,
  };

  // Lecture et recommandations : c'est là que le rapport devient utile
  try {
    const analyse = await redigerJson<{ lecture: string; recommandations: string[] }>(
      `Tu es le consultant en communication d'un food truck de street food thaïlandaise en Île-de-France.
On te donne les chiffres réels d'un mois. Tu écris en français, sobrement, sans flatterie ni jargon.
Réponds uniquement par un objet JSON de la forme {"lecture":"...","recommandations":["...","...","..."]}.
« lecture » fait trois à quatre phrases : ce que disent ces chiffres, honnêtement, y compris si le mois est faible.
« recommandations » contient exactement trois actions concrètes et applicables le mois prochain par une équipe de food truck.`,
      `Mois : ${rapport.intitule}
Publications parties : ${rapport.publications} (${Object.entries(parReseau)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "aucune"})
Échecs d'envoi : ${rapport.echecs}
Services assurés : ${rapport.services}
Vues de la Page Facebook : ${rapport.vuesPage ?? "inconnu"}
Interactions : ${rapport.interactions ?? "inconnu"}
Nouveaux abonnés : ${rapport.nouveauxAbonnes ?? "inconnu"}
Publication la plus performante : ${rapport.meilleure?.legende ?? "aucune mesurée"}`
    );
    rapport.lecture = analyse.lecture;
    rapport.recommandations = (analyse.recommandations ?? []).slice(0, 3);
  } catch {
    // sans IA, le rapport garde ses chiffres
  }

  return rapport;
}
