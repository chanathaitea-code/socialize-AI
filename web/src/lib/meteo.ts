/**
 * Météo du jour, via Open-Meteo : gratuit, sans clé, sans compte.
 * Les coordonnées sont retrouvées à partir du nom du lieu saisi dans les
 * emplacements, puis mises en cache en base pour ne pas réinterroger.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Meteo = {
  lieu: string;
  temperature?: number;
  pluie?: number; // probabilité en %
  resume?: string;
  conseil?: string;
  erreur?: string;
};

const CIELS: Record<number, string> = {
  0: "grand soleil",
  1: "plutôt ensoleillé",
  2: "quelques nuages",
  3: "ciel couvert",
  45: "brouillard",
  48: "brouillard givrant",
  51: "bruine légère",
  53: "bruine",
  55: "bruine dense",
  61: "pluie faible",
  63: "pluie",
  65: "forte pluie",
  71: "neige faible",
  73: "neige",
  75: "forte neige",
  80: "averses",
  81: "averses soutenues",
  82: "fortes averses",
  95: "orage",
  96: "orage avec grêle",
  99: "orage violent",
};

/**
 * « Place des Nymphes Montigny le Bretonneux » n'est pas une adresse connue des
 * annuaires : on essaie du plus précis au plus général, jusqu'à la commune
 * seule, qui finit toujours par répondre.
 */
function variantes(nom: string): string[] {
  const propre = nom.split(",")[0].trim();
  const sansPrefixe = propre.replace(
    /^(place|marché|marche|parking|technopole|campus|centre|parvis|esplanade)\s+(du|de la|des|de|d')?\s*/i,
    ""
  );
  const mots = propre.split(/\s+/);
  const essais = [propre, sansPrefixe];
  for (const n of [3, 2, 1]) {
    if (mots.length > n) essais.push(mots.slice(-n).join(" "));
  }
  // L'annuaire cherche un nom de lieu, pas une adresse : pas de « , France »,
  // et les communes composées s'y trouvent avec des traits d'union.
  const avecTirets = essais.map((e) => e.replace(/\s+/g, "-"));
  return [...new Set([...essais, ...avecTirets].filter((e) => e.length > 2))];
}

async function coordonnees(
  supabase: SupabaseClient,
  brandId: string,
  nom: string
): Promise<{ lat: number; lon: number } | null> {
  const { data: connu } = await supabase
    .from("locations")
    .select("address")
    .eq("brand_id", brandId)
    .eq("name", nom)
    .maybeSingle();
  if (connu?.address?.includes(",")) {
    const [lat, lon] = String(connu.address).split(",").map(Number);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
  }

  let p: { latitude: number; longitude: number } | undefined;
  for (const essai of variantes(nom)) {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(essai)}&count=5&language=fr&format=json`,
      { cache: "no-store" }
    );
    const j = await r.json();
    p = (j?.results ?? []).find((x: { country_code?: string }) => x.country_code === "FR") ?? j?.results?.[0];
    if (p) break;
  }
  if (!p) return null;

  await supabase
    .from("locations")
    .upsert({ brand_id: brandId, name: nom, address: `${p.latitude},${p.longitude}` }, { onConflict: "brand_id,name" });
  return { lat: p.latitude, lon: p.longitude };
}

/** Prévision pour un lieu à une heure donnée (12 pour le midi, 19 pour le soir). */
export async function meteoDuJour(
  supabase: SupabaseClient,
  brandId: string,
  lieu: string,
  heure: number,
  date?: string // AAAA-MM-JJ, aujourd'hui par défaut
): Promise<Meteo> {
  try {
    const pos = await coordonnees(supabase, brandId, lieu);
    if (!pos) return { lieu, erreur: "lieu non localisé" };

    const periode = date ? `&start_date=${date}&end_date=${date}` : "&forecast_days=1";
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}` +
        `&hourly=temperature_2m,precipitation_probability,weather_code${periode}&timezone=Europe%2FParis`,
      { cache: "no-store" }
    );
    const j = await r.json();
    if (j?.error) return { lieu, erreur: String(j.reason ?? "prévision indisponible") };
    const i = Math.min(heure, 23);
    if (typeof j?.hourly?.temperature_2m?.[i] !== "number") {
      return { lieu, erreur: "prévision non disponible pour cette heure" };
    }
    const temperature = Math.round(j?.hourly?.temperature_2m?.[i]);
    const pluie = j?.hourly?.precipitation_probability?.[i];
    const code = j?.hourly?.weather_code?.[i];
    const resume = CIELS[code] ?? "temps variable";

    let conseil: string | undefined;
    if (pluie >= 60) conseil = "Forte probabilité de pluie : prévoyez l'abri et pensez à prévenir en story.";
    else if (temperature >= 28) conseil = "Il va faire chaud : mettez les bubble teas en avant.";
    else if (temperature <= 8) conseil = "Il va faire froid : les plats chauds et le Panang méritent la vedette.";

    return { lieu, temperature, pluie, resume, conseil };
  } catch (e) {
    return { lieu, erreur: e instanceof Error ? e.message : "météo indisponible" };
  }
}
