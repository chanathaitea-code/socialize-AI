/**
 * Google Business Profile : la fiche de l'établissement.
 *
 * Particularité de ces API : un projet Google Cloud neuf a un quota de zéro
 * tant qu'un humain chez Google n'a pas validé la demande d'accès. Tout ce qui
 * est ici fonctionne dès que l'accès est ouvert, et échoue proprement avant,
 * avec un message qui dit ce qu'il manque plutôt qu'une erreur brute.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chiffrer, dechiffrer } from "./crypto";

export const PORTEE = "https://www.googleapis.com/auth/business.manage";

const COMPTES = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFOS = "https://mybusinessbusinessinformation.googleapis.com/v1";
const HERITAGE = "https://mybusiness.googleapis.com/v4"; // posts et avis
const PERFS = "https://businessprofileperformance.googleapis.com/v1";

export type Jetons = { access_token: string; refresh_token?: string; expiry?: number };

/** L'adresse où envoyer l'utilisateur pour qu'il autorise l'application. */
export function urlAutorisation(redirection: string, etat: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirection,
    response_type: "code",
    scope: PORTEE,
    access_type: "offline", // indispensable pour obtenir un jeton de rafraîchissement
    prompt: "consent",
    state: etat,
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function jetonDepuis(corps: Record<string, string>): Promise<Jetons> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(corps).toString(),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error_description ?? j?.error ?? "échange de jeton refusé");
  return {
    access_token: String(j.access_token),
    refresh_token: j.refresh_token ? String(j.refresh_token) : undefined,
    expiry: Date.now() + Number(j.expires_in ?? 3500) * 1000,
  };
}

export const echangerCode = (code: string, redirection: string) =>
  jetonDepuis({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: redirection,
    grant_type: "authorization_code",
  });

export const rafraichir = (refresh_token: string) =>
  jetonDepuis({
    refresh_token,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });

/**
 * Le compte connecté, avec un jeton valide. Google fait expirer l'accès toutes
 * les heures : on le renouvelle en silence à partir du jeton de rafraîchissement.
 */
export async function compteGoogle(
  supabase: SupabaseClient,
  brandId: string
): Promise<{ jeton: string; ressource: string | null; nom: string | null } | null> {
  const { data } = await supabase
    .from("social_accounts")
    .select("id, external_id, handle, encrypted_credentials")
    .eq("brand_id", brandId)
    .eq("platform", "gbp")
    .maybeSingle();
  if (!data) return null;

  const jetons = JSON.parse(dechiffrer(String(data.encrypted_credentials))) as Jetons;
  let acces = jetons.access_token;

  if ((jetons.expiry ?? 0) < Date.now() + 60_000 && jetons.refresh_token) {
    const neuf = await rafraichir(jetons.refresh_token);
    acces = neuf.access_token;
    await supabase
      .from("social_accounts")
      .update({
        encrypted_credentials: chiffrer(
          JSON.stringify({ ...neuf, refresh_token: neuf.refresh_token ?? jetons.refresh_token })
        ),
      })
      .eq("id", data.id);
  }

  return { jeton: acces, ressource: (data.external_id as string) ?? null, nom: (data.handle as string) ?? null };
}

/** Traduit les refus de Google en français, notamment le fameux quota à zéro. */
async function lire(r: Response): Promise<unknown> {
  const brut = await r.text();
  let j: unknown = null;
  try {
    j = JSON.parse(brut);
  } catch {
    j = null;
  }
  if (r.ok) return j;

  const message = String(
    (j as { error?: { message?: string } })?.error?.message ?? brut.slice(0, 200)
  );
  if (r.status === 403 && /quota|not been used|disabled|permission/i.test(message)) {
    throw new Error(
      "Google n'a pas encore ouvert l'accès à l'API Business Profile pour ce projet (quota à zéro). La demande doit être validée par Google avant que la publication fonctionne."
    );
  }
  if (r.status === 429) throw new Error("quota Google dépassé, réessayez dans quelques minutes");
  throw new Error(message || `Google a refusé (${r.status})`);
}

const entetes = (jeton: string) => ({ Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" });

/** Les comptes Business Profile accessibles, puis les fiches de chaque compte. */
export async function fiches(jeton: string): Promise<{ nom: string; titre: string; compte: string }[]> {
  const comptes = (await lire(
    await fetch(`${COMPTES}/accounts`, { headers: entetes(jeton), cache: "no-store" })
  )) as { accounts?: { name: string }[] };

  const sortie: { nom: string; titre: string; compte: string }[] = [];
  for (const c of comptes?.accounts ?? []) {
    const l = (await lire(
      await fetch(
        `${INFOS}/${c.name}/locations?readMask=name,title,storefrontAddress&pageSize=50`,
        { headers: entetes(jeton), cache: "no-store" }
      )
    )) as { locations?: { name: string; title: string }[] };
    for (const loc of l?.locations ?? []) {
      sortie.push({ nom: loc.name, titre: loc.title, compte: c.name });
    }
  }
  return sortie;
}

/** Publie un post « Nouveautés » sur la fiche, avec un bouton vers le site. */
export async function publierPost(
  jeton: string,
  ressource: string, // accounts/123/locations/456
  opts: { texte: string; imageUrl?: string | null; lien?: string }
): Promise<string> {
  const corps: Record<string, unknown> = {
    languageCode: "fr",
    summary: opts.texte.slice(0, 1500),
    topicType: "STANDARD",
  };
  if (opts.lien) corps.callToAction = { actionType: "LEARN_MORE", url: opts.lien };
  if (opts.imageUrl) corps.media = [{ mediaFormat: "PHOTO", sourceUrl: opts.imageUrl }];

  const j = (await lire(
    await fetch(`${HERITAGE}/${ressource}/localPosts`, {
      method: "POST",
      headers: entetes(jeton),
      body: JSON.stringify(corps),
      cache: "no-store",
    })
  )) as { name?: string };
  return String(j?.name ?? "");
}

export type Avis = {
  nom: string;
  auteur: string;
  note: number;
  commentaire: string;
  quand: string;
  reponse: string | null;
};

const NOTES: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export async function listerAvis(jeton: string, ressource: string): Promise<Avis[]> {
  const j = (await lire(
    await fetch(`${HERITAGE}/${ressource}/reviews?pageSize=30&orderBy=updateTime desc`, {
      headers: entetes(jeton),
      cache: "no-store",
    })
  )) as {
    reviews?: {
      name: string;
      reviewer?: { displayName?: string };
      starRating?: string;
      comment?: string;
      createTime?: string;
      reviewReply?: { comment?: string };
    }[];
  };

  return (j?.reviews ?? []).map((a) => ({
    nom: a.name,
    auteur: a.reviewer?.displayName ?? "Un client",
    note: NOTES[String(a.starRating)] ?? 0,
    commentaire: a.comment ?? "",
    quand: a.createTime ?? "",
    reponse: a.reviewReply?.comment ?? null,
  }));
}

export async function repondreAvis(jeton: string, nomAvis: string, reponse: string): Promise<void> {
  await lire(
    await fetch(`${HERITAGE}/${nomAvis}/reply`, {
      method: "PUT",
      headers: entetes(jeton),
      body: JSON.stringify({ comment: reponse.slice(0, 4096) }),
      cache: "no-store",
    })
  );
}

export type MesuresGoogle = {
  vuesRecherche?: number;
  vuesMaps?: number;
  clicsSite?: number;
  itineraires?: number;
  appels?: number;
};

const METRIQUES = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
];

/** Les chiffres de la fiche sur les trente derniers jours. */
export async function mesuresFiche(jeton: string, ressource: string): Promise<MesuresGoogle> {
  const loc = ressource.split("/").slice(-2).join("/"); // locations/456
  const fin = new Date();
  const debut = new Date(fin.getTime() - 30 * 86_400_000);
  const d = (x: Date, p: string) =>
    `${p}.year=${x.getUTCFullYear()}&${p}.month=${x.getUTCMonth() + 1}&${p}.day=${x.getUTCDate()}`;

  const p = new URLSearchParams();
  for (const m of METRIQUES) p.append("dailyMetrics", m);
  const url = `${PERFS}/${loc}:fetchMultiDailyMetricsTimeSeries?${p.toString()}&${d(debut, "dailyRange.start_date")}&${d(fin, "dailyRange.end_date")}`;

  const j = (await lire(await fetch(url, { headers: entetes(jeton), cache: "no-store" }))) as {
    multiDailyMetricTimeSeries?: {
      dailyMetricTimeSeries?: {
        dailyMetric?: string;
        timeSeries?: { datedValues?: { value?: string }[] };
      }[];
    }[];
  };

  const total = (nom: string) => {
    let n = 0;
    for (const bloc of j?.multiDailyMetricTimeSeries ?? []) {
      for (const serie of bloc.dailyMetricTimeSeries ?? []) {
        if (serie.dailyMetric !== nom) continue;
        for (const v of serie.timeSeries?.datedValues ?? []) n += Number(v.value ?? 0);
      }
    }
    return n;
  };

  return {
    vuesRecherche: total("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH") + total("BUSINESS_IMPRESSIONS_MOBILE_SEARCH"),
    vuesMaps: total("BUSINESS_IMPRESSIONS_DESKTOP_MAPS") + total("BUSINESS_IMPRESSIONS_MOBILE_MAPS"),
    clicsSite: total("WEBSITE_CLICKS"),
    itineraires: total("BUSINESS_DIRECTION_REQUESTS"),
    appels: total("CALL_CLICKS"),
  };
}
