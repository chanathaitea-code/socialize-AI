"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { MOIS } from "@/lib/semaine";
import { premierDuMois } from "@/lib/rapport";
import { construirePlan, verifier } from "@/lib/ligne";

const borne = (raw: unknown) => Math.max(-1, Math.min(3, parseInt(String(raw ?? "0"), 10) || 0));

/** Établit — ou refait — la ligne éditoriale d'un mois. */
export async function etablirLigne(formData: FormData) {
  const decalage = borne(formData.get("decalage"));
  const retour = (p: string) => redirect(`/calendrier?m=${decalage}&${p}`);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id, brand_brief").limit(1);
  const brand = brands?.[0];
  if (!brand) retour("err=Marque%20introuvable");

  const mois = premierDuMois(decalage);
  const cle = mois.toISOString().slice(0, 10);

  try {
    const plan = await construirePlan(supabase, brand!.id, mois);
    if (!plan.contenus.length) retour("err=Le%20mod%C3%A8le%20n%27a%20rien%20propos%C3%A9");

    const { data: produits } = await supabase
      .from("products")
      .select("name, price_cents")
      .eq("brand_id", brand!.id);
    const prixConnus = new Set(
      (produits ?? [])
        .filter((p) => p.price_cents)
        .map((p) => (p.price_cents! / 100).toFixed(2).replace(".", ",").replace(",00", ""))
    );
    const brief = (brand!.brand_brief ?? {}) as Record<string, string>;
    const interdits = (brief.interdits ?? "")
      .split(/[,;\n]/)
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 2);

    // On remplace la ligne du mois : refaire, c'est repartir de zéro, sauf
    // pour ce qui est déjà programmé ou parti.
    await supabase
      .from("editorial_items")
      .delete()
      .eq("brand_id", brand!.id)
      .eq("mois", cle)
      .in("statut", ["prevu", "garde", "rejete"]);

    const lignes = plan.contenus.map((c) => {
      const jour = new Date(mois);
      jour.setUTCDate(Number(c.jour));
      return {
        brand_id: brand!.id,
        mois: cle,
        jour: jour.toISOString().slice(0, 10),
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
    if (error) retour(`err=${encodeURIComponent(error.message)}`);

    await supabase.from("editorial_months").upsert(
      {
        brand_id: brand!.id,
        mois: cle,
        theme: plan.theme ?? null,
        produit_phare: plan.produitPhare ?? null,
        objectif: plan.objectif ?? null,
        lecture: plan.lecture ?? null,
      },
      { onConflict: "brand_id,mois" }
    );

    revalidatePath("/calendrier");
    retour(
      `ok=${encodeURIComponent(
        `Ligne éditoriale de ${MOIS[mois.getUTCMonth()]} établie : ${lignes.length} contenus`
      )}`
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "génération impossible")}`);
  }
}

/** Garder ou écarter un contenu du calendrier. */
export async function changerStatutItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const statut = String(formData.get("statut") ?? "garde");
  const decalage = borne(formData.get("decalage"));
  if (!id) return;
  const supabase = await supabaseServer();
  await supabase.from("editorial_items").update({ statut }).eq("id", id);
  revalidatePath("/calendrier");
  redirect(`/calendrier?m=${decalage}`);
}

/** Supprimer une case du calendrier. */
export async function supprimerItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decalage = borne(formData.get("decalage"));
  if (!id) return;
  const supabase = await supabaseServer();
  await supabase.from("editorial_items").delete().eq("id", id);
  revalidatePath("/calendrier");
  redirect(`/calendrier?m=${decalage}`);
}
