/**
 * Le design de la marque : ce que Pierre décrit en une phrase devient des
 * couleurs réutilisables partout, et, si la génération d'images est activée,
 * des fonds fabriqués sur mesure.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { THEMES, type Theme } from "./story";
import { redigerJson } from "./ia";

/** Les quatre thèmes livrés, plus ceux que la marque s'est fait écrire. */
export async function chargerThemes(
  supabase: SupabaseClient,
  brandId?: string
): Promise<Record<string, Theme>> {
  let requete = supabase.from("brand_themes").select("cle, nom, bg, accent, photo");
  if (brandId) requete = requete.eq("brand_id", brandId);
  const { data } = await requete;
  const perso: Record<string, Theme> = {};
  for (const t of data ?? []) {
    perso[String(t.cle)] = {
      nom: String(t.nom),
      bg: String(t.bg),
      accent: String(t.accent),
      photo: String(t.photo),
    };
  }
  return { ...THEMES, ...perso };
}

/** Un thème par sa clé, sans jamais planter : le vert reste le filet. */
export async function unTheme(
  supabase: SupabaseClient,
  brandId: string | undefined,
  cle: string | null | undefined
): Promise<Theme> {
  const tous = await chargerThemes(supabase, brandId);
  return tous[cle ?? "vert"] ?? THEMES.vert;
}

const CONSIGNE_COULEURS = `Tu es directeur artistique. On te décrit l'ambiance visuelle voulue par un food truck de street food thaïlandaise.
Tu proposes trois chartes de couleurs utilisables telles quelles dans une story verticale.
Contraintes techniques absolues :
- « bg » est un dégradé CSS linéaire sombre, de la forme linear-gradient(175deg,#xxxxxx,#xxxxxx 50%,#xxxxxx) — le texte blanc doit rester lisible dessus ;
- « accent » est une couleur vive en hexadécimal, lisible avec du texte noir posé dessus ;
- « photo » est un dégradé CSS linéaire de remplacement, utilisé quand il n'y a pas de photo ;
- pas de conic-gradient, pas de radial-gradient, pas de transparence, pas de nom de couleur : uniquement des hexadécimaux.
Réponds uniquement par {"themes":[{"nom":"...","bg":"...","accent":"#xxxxxx","photo":"..."}]} avec exactement trois entrées.
« nom » fait deux ou trois mots en français.`;

export type ThemePropose = { nom: string; bg: string; accent: string; photo: string };

/** Traduit une envie décrite en français en trois chartes utilisables. */
export async function proposerThemes(description: string, marque: string): Promise<ThemePropose[]> {
  const r = await redigerJson<{ themes: ThemePropose[] }>(
    CONSIGNE_COULEURS,
    `Marque : ${marque}
Ambiance visuelle souhaitée, dans les mots du patron : ${description}`
  );
  const hex = /^#[0-9a-fA-F]{6}$/;
  return (r.themes ?? [])
    .filter((t) => t.bg?.startsWith("linear-gradient") && hex.test(t.accent ?? "") && t.photo?.startsWith("linear-gradient"))
    .slice(0, 3);
}

/**
 * Fond fabriqué par un modèle d'images, au format vertical d'une story.
 * La génération d'images n'est pas comprise dans le palier gratuit de Google :
 * sans clé facturée, on le dit clairement plutôt que d'échouer en silence.
 */
export async function genererFond(
  description: string,
  reference?: { base64: string; mime: string }
): Promise<Buffer> {
  const cle = process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("aucune clé d'images configurée");

  const modele = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  const input: Record<string, unknown>[] = [
    {
      type: "text",
      text: `Photographie publicitaire verticale pour un food truck de street food thaïlandaise en France.
${description}
Cadrage vertical 9:16, lumière naturelle, rendu appétissant et réaliste, aucune écriture ni logo dans l'image,
zone calme en haut et en bas pour laisser place à du texte ajouté ensuite.`,
    },
  ];
  if (reference) input.push({ type: "image", mime_type: reference.mime, data: reference.base64 });

  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": cle, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modele,
      input,
      response_format: { type: "image", aspect_ratio: "9:16" },
    }),
    cache: "no-store",
  });

  const brut = await r.text();
  if (!r.ok) {
    const message = lireErreur(brut);
    if (r.status === 429 || /quota|billing|facturation|free tier/i.test(message)) {
      throw new Error(
        "la génération d'images n'est pas comprise dans la clé Google gratuite : il faut activer la facturation sur le compte Google AI (environ 4 centimes par image)"
      );
    }
    throw new Error(message || `génération refusée (${r.status})`);
  }

  const donnees = trouverImage(JSON.parse(brut));
  if (!donnees) throw new Error("le modèle n'a pas renvoyé d'image");
  return Buffer.from(donnees, "base64");
}

function lireErreur(brut: string): string {
  try {
    const j = JSON.parse(brut);
    return String(j?.error?.message ?? j?.message ?? "").slice(0, 300);
  } catch {
    return brut.slice(0, 300);
  }
}

/**
 * Le format de réponse a bougé plusieurs fois côté Google : plutôt que de
 * dépendre d'un chemin précis, on cherche la première donnée d'image dans
 * l'objet, quelle que soit sa place.
 */
function trouverImage(noeud: unknown): string | null {
  if (!noeud || typeof noeud !== "object") return null;
  if (Array.isArray(noeud)) {
    for (const x of noeud) {
      const t = trouverImage(x);
      if (t) return t;
    }
    return null;
  }
  const o = noeud as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type : "";
  const mime = String(o.mime_type ?? o.mimeType ?? "");
  if ((type === "image" || mime.startsWith("image/")) && typeof o.data === "string" && o.data.length > 100) {
    return o.data;
  }
  if (typeof o.imageBytes === "string" && o.imageBytes.length > 100) return o.imageBytes;
  for (const v of Object.values(o)) {
    const t = trouverImage(v);
    if (t) return t;
  }
  return null;
}
