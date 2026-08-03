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
 * La consigne à coller dans ChatGPT (ou n'importe quel outil d'images) pour
 * obtenir un visuel utilisable tel quel comme fond de story. Tout est dedans :
 * le format vertical, l'interdiction d'écrire du texte, et le style de la
 * marque tel que le patron l'a décrit.
 */
export function consignePourOutilExterne(sujet: string, style: string, marque: string): string {
  return [
    `Image verticale 9:16 (1080 × 1920 pixels) pour une story Instagram de ${marque}, food truck de street food thaïlandaise en Île-de-France.`,
    "",
    `Sujet : ${sujet.trim() || "un plat thaïlandais fumant, vu de près"}`,
    "",
    style.trim() ? `Style voulu : ${style.trim()}` : "Style : photographie réaliste, lumière naturelle, rendu appétissant.",
    "",
    "Contraintes :",
    "— aucun texte, aucun logo, aucun filigrane dans l'image ;",
    "— cadrage vertical strict, le sujet centré dans la moitié haute ;",
    "— zones calmes en haut et en bas, du texte sera ajouté par-dessus ensuite ;",
    "— rendu photographique réaliste, pas d'illustration ni de rendu 3D ;",
    "— pas de mains ni de visages en gros plan.",
    "",
    "Renvoie une seule image.",
  ].join("\n");
}

/**
 * Fond fabriqué automatiquement par un modèle d'images. Deux fournisseurs
 * possibles : OpenAI si une clé d'API est configurée, Google sinon. Dans les
 * deux cas il s'agit d'une clé d'API facturée, pas d'un abonnement ChatGPT :
 * sans elle, on le dit clairement plutôt que d'échouer en silence.
 */
export async function genererFond(
  description: string,
  reference?: { base64: string; mime: string }
): Promise<Buffer> {
  if (process.env.OPENAI_API_KEY) return genererFondOpenAI(description);

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

/** Même chose côté OpenAI, si une clé d'API y est configurée. */
async function genererFondOpenAI(description: string): Promise<Buffer> {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: description,
      size: "1024x1536",
      n: 1,
    }),
    cache: "no-store",
  });
  const brut = await r.text();
  if (!r.ok) throw new Error(lireErreur(brut) || `génération refusée (${r.status})`);
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
  if (typeof o.b64_json === "string" && o.b64_json.length > 100) return o.b64_json;
  for (const v of Object.values(o)) {
    const t = trouverImage(v);
    if (t) return t;
  }
  return null;
}
