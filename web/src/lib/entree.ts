/**
 * Le parcours d'entrée : le client donne le nom de son entreprise et l'adresse
 * de son site, l'IA propose tout le reste. Il corrige et valide.
 * Le principe du cahier des charges : le client confirme plutôt qu'il ne crée.
 */
import { redigerJson } from "./ia";
import { texteDuSite } from "./marque";

export type Profil = {
  activite: string;
  positionnement: string;
  cible: string;
  zone: string;
  ton: string;
  objectifs: string;
  interdits: string;
  ville: string;
  handle: string;
  produits: { nom: string; prix: string }[];
};

const CONSIGNE = `Tu prépares la fiche d'une entreprise pour un outil de communication sur les réseaux sociaux.
On te donne le nom de l'entreprise et le texte brut de son site web. Tu en déduis son profil.
Tu écris en français, sobrement, sans flatterie ni jargon marketing.

Règles :
- ne rien inventer : si le site ne dit rien d'un champ, écris une phrase générique et prudente plutôt qu'un détail faux ;
- « produits » ne contient que des articles réellement cités sur le site, avec le prix exact si le site l'affiche, sinon un prix vide ;
- « handle » est le compte Instagram s'il apparaît sur le site, sans le @, sinon une chaîne vide ;
- « interdits » liste les mots ou promesses que cette entreprise ne devrait pas employer (par exemple des allégations de santé, ou des mots interdits par sa réglementation).

Réponds uniquement par un objet JSON :
{"activite":"...","positionnement":"...","cible":"...","zone":"...","ton":"...","objectifs":"...","interdits":"...","ville":"...","handle":"...","produits":[{"nom":"...","prix":"12,50 €"}]}

« activite » fait une phrase. « positionnement » fait une à deux phrases sur ce qui distingue l'entreprise.
« cible » décrit les clients. « zone » donne la zone géographique desservie. « ton » décrit la voix à employer.
« objectifs » dit ce que l'entreprise cherche à obtenir de sa communication.`;

/** Analyse le site et propose un profil complet, prêt à corriger. */
export async function deduireProfil(nom: string, site: string): Promise<Profil> {
  let contenu = "";
  let avertissement = "";
  try {
    contenu = await texteDuSite(site);
  } catch (e) {
    avertissement = e instanceof Error ? e.message : "site illisible";
  }

  const profil = await redigerJson<Profil>(
    CONSIGNE,
    `Nom de l'entreprise : ${nom}
Adresse du site : ${site || "non fourni"}
${contenu ? `Contenu du site :\n${contenu}` : `Le site n'a pas pu être lu (${avertissement}). Déduis ce que tu peux du seul nom, en restant prudent.`}`
  );

  return {
    activite: profil.activite ?? "",
    positionnement: profil.positionnement ?? "",
    cible: profil.cible ?? "",
    zone: profil.zone ?? "",
    ton: profil.ton ?? "",
    objectifs: profil.objectifs ?? "",
    interdits: profil.interdits ?? "",
    ville: profil.ville ?? "",
    handle: (profil.handle ?? "").replace(/^@/, ""),
    produits: (profil.produits ?? []).filter((p) => p?.nom).slice(0, 30),
  };
}

/** « 12,50 € », « 12.5 », « 12 » → 1250 centimes. Vide → null. */
export function centimes(prix: string): number | null {
  const n = parseFloat(String(prix).replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
