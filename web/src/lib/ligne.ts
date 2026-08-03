/**
 * La ligne éditoriale : le cap du mois et le calendrier qui en découle.
 *
 * L'idée n'est pas de produire trente textes d'un coup, mais de décider une
 * bonne fois pour toutes ce qu'on raconte ce mois-ci, à quel rythme, sur quels
 * sujets — puis de laisser chaque contenu se fabriquer au moment voulu.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MOIS, iso } from "./semaine";
import { redigerJson } from "./ia";

export type ItemPlan = {
  jour: number; // quantième dans le mois
  format: string; // story, post, reel, avis
  gabarit: string; // plat, avis, coulisses, rebours, semaine, jour, libre
  rubrique: string;
  objectif: string;
  accroche?: string;
  texte?: string;
  hashtags?: string;
  conseil?: string;
};

export type Plan = {
  theme: string;
  produitPhare: string;
  objectif: string;
  lecture: string;
  contenus: ItemPlan[];
};

/**
 * Ce qui fait vraiment vendre un food truck thaï en Île-de-France, mois par
 * mois. Ces repères évitent le calendrier hors-sol qui parle de barbecue en
 * février et oublie le nouvel an thaïlandais en avril.
 */
export const MARRONNIERS: string[][] = [
  ["galette et retour au bureau", "bonnes résolutions : le thaï est léger", "froid : plats en sauce et soupes"],
  ["Nouvel An chinois et asiatique", "Saint-Valentin", "vacances d'hiver de la zone C"],
  ["premiers rayons, retour des files dehors", "printemps : plats plus frais", "journée internationale des droits des femmes"],
  ["Songkran, le nouvel an thaïlandais (13-15 avril)", "Pâques", "premières terrasses et pique-niques"],
  ["ponts du 1er et du 8 mai", "fête des mères", "premières demandes de privatisation pour l'été"],
  ["fête de la musique", "fête des pères", "kermesses, fêtes d'école, festivals", "début des soirées dehors"],
  ["vacances : moins de bureaux, plus de familles", "marchés et festivals d'été", "bubble tea et fraîcheur"],
  ["mois creux : ceux qui restent sont fidèles", "préparer la rentrée", "réservations de septembre"],
  ["rentrée : réinstaller les habitudes du midi", "forums des associations", "retour des salariés au bureau"],
  ["Halloween", "il fait froid : plats chauds et épicés", "Loy Krathong approche"],
  ["Beaujolais nouveau", "arbres de Noël d'entreprise : privatisations", "marchés de Noël"],
  ["fêtes de fin d'année", "privatisations et plateaux", "fermetures : annoncer les dates"],
];

const CONSIGNE = `Tu es le directeur de la communication d'un food truck de street food thaïlandaise en Île-de-France.
On te demande la ligne éditoriale d'un mois entier : un cap, puis un calendrier de publications.
Tu écris en français, sobrement, sans jargon marketing ni superlatif creux.

Règles absolues :
- ne cite jamais un prix absent de la carte fournie ;
- ne promets rien qui ne soit pas dans les informations fournies (pas de livraison, pas d'horaires inventés) ;
- les jours de service sont donnés : les contenus d'emplacement et de compte à rebours ne peuvent tomber que ces jours-là ;
- varie les sujets : produit, coulisses, client, emplacement, saison, événement, privatisation ;
- deux à trois contenus par semaine au maximum : mieux vaut peu et régulier que beaucoup et abandonné.

Réponds uniquement par un objet JSON :
{"theme":"...","produitPhare":"...","objectif":"...","lecture":"...","contenus":[{"jour":3,"format":"story","gabarit":"plat","rubrique":"...","objectif":"...","accroche":"...","texte":"...","hashtags":"...","conseil":"..."}]}

« theme » est le cap du mois en quelques mots. « lecture » explique en trois phrases pourquoi ce cap, à partir des chiffres et de la saison.
« jour » est le quantième dans le mois. « format » vaut story, post ou reel.
« gabarit » vaut plat, avis, coulisses, rebours, semaine ou libre :
  - plat : un plat mis en avant avec son prix,
  - avis : un avis client,
  - coulisses : la préparation, l'équipe,
  - rebours : « on ouvre dans une heure », uniquement un jour de service,
  - semaine : l'annonce des emplacements de la semaine, le dimanche ou le lundi,
  - libre : tout le reste (saison, événement, privatisation).
« conseil » dit en une phrase quoi photographier ou filmer.`;

/** Établit le plan du mois à partir du réel : carte, emplacements, chiffres. */
export async function construirePlan(
  supabase: SupabaseClient,
  brandId: string,
  mois: Date
): Promise<Plan> {
  const finMois = new Date(mois);
  finMois.setUTCMonth(finMois.getUTCMonth() + 1);
  const nbJours = Math.round((finMois.getTime() - mois.getTime()) / 86_400_000);

  const [{ data: brands }, { data: produits }, { data: slots }, { data: pubs }] = await Promise.all([
    supabase.from("brands").select("id, name, brand_brief").eq("id", brandId).limit(1),
    supabase.from("products").select("name, price_cents, out_of_stock").eq("brand_id", brandId),
    supabase
      .from("location_schedule")
      .select("day, service, time_range, note, status")
      .eq("brand_id", brandId)
      .gte("day", iso(mois))
      .lt("day", iso(finMois))
      .neq("status", "cancelled")
      .order("day"),
    supabase
      .from("publication_log")
      .select("platform, status, caption, metrics, created_at")
      .eq("brand_id", brandId)
      .gte("created_at", new Date(mois.getTime() - 60 * 86_400_000).toISOString())
      .lt("created_at", mois.toISOString()),
  ]);

  const brand = brands?.[0];
  const brief = ((brand?.brand_brief ?? {}) as Record<string, string>) ?? {};

  const carte = (produits ?? [])
    .filter((p) => !p.out_of_stock)
    .map((p) => `${p.name}${p.price_cents ? ` (${(p.price_cents / 100).toFixed(2).replace(".", ",")} €)` : ""}`)
    .join(", ");

  // Les jours de service, groupés : « 3 : midi Montigny (11h30-14h) »
  const parJour = new Map<string, string[]>();
  for (const s of slots ?? []) {
    const q = String(Number(String(s.day).slice(8, 10)));
    const l = `${s.service} ${s.note ?? ""}${s.time_range ? ` (${s.time_range})` : ""}`;
    parJour.set(q, [...(parJour.get(q) ?? []), l]);
  }
  const services = [...parJour.entries()].map(([q, l]) => `${q} : ${l.join(" et ")}`).join(" · ");

  const publiees = (pubs ?? []).filter((p) => p.status === "published");
  const intitule = `${MOIS[mois.getUTCMonth()]} ${mois.getUTCFullYear()}`;

  const demande = `Mois à planifier : ${intitule} (${nbJours} jours)
Marque : ${brand?.name ?? "Chana Thaï"}
Activité : ${brief.activite ?? "food truck de cuisine thaïlandaise"}
Positionnement : ${brief.positionnement ?? ""}
Public : ${brief.cible ?? ""}
Zone : ${brief.zone ?? ""}
Ton : ${brief.ton ?? "convivial et gourmand"}
Objectifs : ${brief.objectifs ?? ""}
À ne jamais publier : ${brief.interdits ?? "rien de particulier"}
Carte et prix exacts : ${carte || "non renseignée"}
Jours de service déjà planifiés (quantième du mois) : ${services || "aucun emplacement saisi pour ce mois"}
Repères de saison en France ce mois-ci : ${(MARRONNIERS[mois.getUTCMonth()] ?? []).join(" · ")}
Publications des deux derniers mois : ${publiees.length}

Établis la ligne éditoriale de ${intitule} : le cap, puis 8 à 12 contenus répartis sur le mois.`;

  const plan = await redigerJson<Plan>(CONSIGNE, demande);
  const contenus = (plan.contenus ?? [])
    .filter((c) => Number(c.jour) >= 1 && Number(c.jour) <= nbJours)
    .slice(0, 16);
  return { ...plan, contenus };
}

/**
 * Établit et enregistre la ligne éditoriale d'un mois. Partagé par le bouton de
 * l'écran Calendrier et par la tâche planifiée du 1er du mois.
 */
export async function enregistrerPlan(
  supabase: SupabaseClient,
  brandId: string,
  mois: Date
): Promise<{ theme: string; nombre: number }> {
  const cle = iso(mois);
  const plan = await construirePlan(supabase, brandId, mois);
  if (!plan.contenus.length) throw new Error("le modèle n'a rien proposé");

  const { data: produits } = await supabase
    .from("products")
    .select("name, price_cents")
    .eq("brand_id", brandId);
  const prixConnus = new Set(
    (produits ?? [])
      .filter((p) => p.price_cents)
      .map((p) => (p.price_cents! / 100).toFixed(2).replace(".", ",").replace(",00", ""))
  );

  const { data: brands } = await supabase.from("brands").select("brand_brief").eq("id", brandId).limit(1);
  const brief = ((brands?.[0]?.brand_brief ?? {}) as Record<string, string>) ?? {};
  const interdits = (brief.interdits ?? "")
    .split(/[,;\n]/)
    .map((m) => m.trim().toLowerCase())
    .filter((m) => m.length > 2);

  // Refaire un mois efface les projets, jamais ce qui est déjà programmé ou parti.
  await supabase
    .from("editorial_items")
    .delete()
    .eq("brand_id", brandId)
    .eq("mois", cle)
    .in("statut", ["prevu", "garde", "rejete"]);

  const lignes = plan.contenus.map((c) => {
    const jour = new Date(mois);
    jour.setUTCDate(Number(c.jour));
    return {
      brand_id: brandId,
      mois: cle,
      jour: iso(jour),
      format: (c.format ?? "story").toLowerCase(),
      gabarit: (c.gabarit ?? "libre").toLowerCase(),
      rubrique: c.rubrique ?? null,
      objectif: c.objectif ?? null,
      accroche: c.accroche ?? null,
      texte: c.texte ?? null,
      hashtags: c.hashtags ?? null,
      conseil: c.conseil ?? null,
      alertes: verifier(`${c.accroche ?? ""} ${c.texte ?? ""}`, prixConnus, interdits),
    };
  });

  const { error } = await supabase.from("editorial_items").insert(lignes);
  if (error) throw new Error(error.message);

  await supabase.from("editorial_months").upsert(
    {
      brand_id: brandId,
      mois: cle,
      theme: plan.theme ?? null,
      produit_phare: plan.produitPhare ?? null,
      objectif: plan.objectif ?? null,
      lecture: plan.lecture ?? null,
    },
    { onConflict: "brand_id,mois" }
  );

  return { theme: plan.theme ?? "", nombre: lignes.length };
}

/** Garde-fous partagés : prix inventés et mots que la marque s'interdit. */
export function verifier(
  texte: string,
  prixConnus: Set<string>,
  interdits: string[]
): string[] {
  const alertes: string[] = [];
  for (const prix of texte.match(/\d+(?:[.,]\d{1,2})?\s?€/g) ?? []) {
    const normalise = prix.replace(/\s?€/, "").replace(".", ",").replace(",00", "");
    if (!prixConnus.has(normalise)) alertes.push(`prix ${prix} absent de la carte`);
  }
  for (const mot of interdits) {
    if (texte.toLowerCase().includes(mot)) alertes.push(`mot à éviter : ${mot}`);
  }
  return alertes;
}
