"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import { legendeJours, lignesSemaine, type Slot } from "@/lib/story";
import { redigerJson } from "@/lib/ia";

type Idee = {
  jour?: string;
  format?: string;
  angle?: string;
  accroche?: string;
  texte?: string;
  hashtags?: string;
  conseil?: string;
};

const CONSIGNE = `Tu es le community manager d'un food truck de street food thaïlandaise en Île-de-France.
Tu écris en français, dans le ton donné par la marque, pour Instagram et Facebook.
Règles absolues :
- ne cite jamais un prix qui ne figure pas dans la carte fournie ;
- ne promets rien qui ne soit pas dans les informations fournies (pas de livraison, pas d'horaires inventés) ;
- pas de superlatifs creux, pas de langue de bois, pas d'emphase publicitaire ;
- des textes courts, concrets, ancrés dans le réel du camion et des emplacements ;
- varie les angles : coulisses, savoir-faire, produit, emplacement du jour, client, saison, événement.
Réponds uniquement par un objet JSON de la forme {"idees":[{"jour","format","angle","accroche","texte","hashtags","conseil"}]}.
Le champ jour vaut Lundi..Dimanche ou une chaîne vide si le contenu est intemporel.
Le champ format vaut post, story, reel ou avis.
Le champ conseil décrit en une phrase ce qu'il faut filmer ou photographier.`;

export async function genererSemaine(formData: FormData) {
  const w = clampWeek(formData.get("w"));
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id, name, brand_brief").limit(1);
  const brand = brands?.[0];
  if (!brand) redirect("/studio?err=Marque%20introuvable");

  const { data: produits } = await supabase
    .from("products")
    .select("name, price_cents, out_of_stock")
    .eq("brand_id", brand.id);

  const monday = mondayOf(w);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const { data: slots } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .eq("brand_id", brand.id)
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day");

  const brief = (brand.brand_brief ?? {}) as Record<string, string>;
  const carte = (produits ?? [])
    .filter((p) => !p.out_of_stock)
    .map((p) => `${p.name}${p.price_cents ? ` (${(p.price_cents / 100).toFixed(2).replace(".", ",")} €)` : ""}`)
    .join(", ");
  const ruptures = (produits ?? []).filter((p) => p.out_of_stock).map((p) => p.name);
  const emplacements = legendeJours(lignesSemaine((slots ?? []) as Slot[], monday));

  const demande = `Marque : ${brand.name}
Activité : ${brief.activite ?? "food truck de cuisine thaïlandaise"}
Positionnement : ${brief.positionnement ?? ""}
Public : ${brief.cible ?? ""}
Zone : ${brief.zone ?? ""}
Ton : ${brief.ton ?? "convivial et gourmand"}
Objectifs : ${brief.objectifs ?? ""}
À ne jamais publier : ${brief.interdits ?? "rien de particulier"}
Carte et prix exacts : ${carte || "non renseignée"}
Produits en rupture, à ne pas mettre en avant : ${ruptures.join(", ") || "aucun"}
Emplacements de la semaine ${libellePeriode(monday)} : ${emplacements || "aucun emplacement saisi"}

Propose 6 contenus pour cette semaine : au moins un qui annonce les emplacements, un de coulisses,
un centré produit, un qui donne envie de privatiser le camion pour un événement.`;

  try {
    const reponse = await redigerJson<{ idees: Idee[] }>(CONSIGNE, demande);
    const idees = (reponse.idees ?? []).slice(0, 8);
    if (!idees.length) redirect("/studio?err=Le%20mod%C3%A8le%20n%27a%20rien%20propos%C3%A9");

    // Garde-fous : prix inventés et mots interdits
    const prixConnus = new Set(
      (produits ?? [])
        .filter((p) => p.price_cents)
        .map((p) => (p.price_cents! / 100).toFixed(2).replace(".", ",").replace(",00", ""))
    );
    const interdits = (brief.interdits ?? "")
      .split(/[,;\n]/)
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 2);

    const lignes = idees.map((i) => {
      const texte = `${i.accroche ?? ""} ${i.texte ?? ""}`;
      const alertes: string[] = [];
      for (const prix of texte.match(/\d+(?:[.,]\d{1,2})?\s?€/g) ?? []) {
        const normalise = prix.replace(/\s?€/, "").replace(".", ",").replace(",00", "");
        if (!prixConnus.has(normalise)) alertes.push(`prix ${prix} absent de la carte`);
      }
      for (const mot of interdits) {
        if (texte.toLowerCase().includes(mot)) alertes.push(`mot à éviter : ${mot}`);
      }
      return {
        brand_id: brand.id,
        monday: iso(monday),
        jour: i.jour || null,
        format: (i.format ?? "post").toLowerCase(),
        angle: i.angle ?? null,
        accroche: i.accroche ?? null,
        texte: i.texte ?? null,
        hashtags: i.hashtags ?? null,
        conseil: i.conseil ?? null,
        alertes,
      };
    });

    const { error } = await supabase.from("content_ideas").insert(lignes);
    if (error) redirect(`/studio?err=${encodeURIComponent(error.message)}`);
    revalidatePath("/studio");
    redirect(`/studio?w=${w}&ok=${lignes.length}%20contenus%20propos%C3%A9s`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    redirect(`/studio?w=${w}&err=${encodeURIComponent(e instanceof Error ? e.message : "génération impossible")}`);
  }
}

export async function changerStatut(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  const statut = String(formData.get("statut") ?? "garde");
  if (!id) return;
  await supabase.from("content_ideas").update({ statut }).eq("id", id);
  revalidatePath("/studio");
}

export async function supprimerIdee(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("content_ideas").delete().eq("id", id);
  revalidatePath("/studio");
}
