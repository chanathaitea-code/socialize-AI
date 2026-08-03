/**
 * L'identité de la marque, partagée par tous les visuels.
 *
 * Rien ne doit être écrit en dur : le nom, le compte et l'adresse du site
 * changent d'un client à l'autre, et ils apparaissent sur chaque image publiée.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Identite = { nom: string; compte: string; site: string };

const PAR_DEFAUT: Identite = { nom: "MA MARQUE", compte: "", site: "" };

export async function identite(supabase: SupabaseClient, brandId?: string): Promise<Identite> {
  let requete = supabase.from("brands").select("name, handle, website").limit(1);
  if (brandId) requete = supabase.from("brands").select("name, handle, website").eq("id", brandId).limit(1);
  const { data } = await requete;
  const b = data?.[0];
  if (!b) return PAR_DEFAUT;

  const compte = String(b.handle ?? "").trim();
  const site = String(b.website ?? "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return {
    nom: String(b.name ?? "Ma marque").toUpperCase(),
    compte: compte ? (compte.startsWith("@") ? compte : `@${compte}`) : "",
    site,
  };
}

/**
 * Lit une page web et en extrait le texte utile. Sert au parcours d'entrée :
 * le client donne l'adresse de son site, l'IA en déduit son profil.
 */
export async function texteDuSite(url: string): Promise<string> {
  const adresse = url.startsWith("http") ? url : `https://${url}`;
  const r = await fetch(adresse, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialFlow/1.0)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`site injoignable (${r.status})`);
  const html = await r.text();

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&(?:eacute|egrave|ecirc);/g, "é")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}
