"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { centimes, deduireProfil } from "@/lib/entree";

async function laMarque() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("brands").select("id, name").limit(1);
  return { supabase, brand: data?.[0] ?? null };
}

/** Étape 1 : on lit le site et on propose un profil, sans encore rien figer. */
export async function analyser(formData: FormData) {
  const nom = String(formData.get("nom") ?? "").trim();
  const site = String(formData.get("site") ?? "").trim();
  if (!nom) redirect("/bienvenue?err=Indiquez%20le%20nom%20de%20votre%20entreprise");

  const { supabase, brand } = await laMarque();
  if (!brand) redirect("/bienvenue?err=Compte%20introuvable");

  try {
    const profil = await deduireProfil(nom, site);

    // Le profil proposé est rangé tel quel : l'écran suivant le montre et
    // le rend modifiable. Rien n'est publié tant que ce n'est pas validé.
    await supabase
      .from("brands")
      .update({
        name: nom,
        website: site || null,
        city: profil.ville || null,
        handle: profil.handle || null,
        brand_brief: {
          activite: profil.activite,
          positionnement: profil.positionnement,
          cible: profil.cible,
          zone: profil.zone,
          ton: profil.ton,
          objectifs: profil.objectifs,
          interdits: profil.interdits,
        },
      })
      .eq("id", brand.id);

    if (profil.produits.length) {
      const { data: deja } = await supabase.from("products").select("id").eq("brand_id", brand.id).limit(1);
      if (!deja?.length) {
        await supabase.from("products").insert(
          profil.produits.map((p) => ({
            brand_id: brand.id,
            name: p.nom.slice(0, 120),
            price_cents: centimes(p.prix),
          }))
        );
      }
    }

    revalidatePath("/bienvenue");
    redirect("/bienvenue?etape=2");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    redirect(`/bienvenue?err=${encodeURIComponent(e instanceof Error ? e.message : "analyse impossible")}`);
  }
}

/** Étape 2 : le client corrige ce que l'IA a proposé, et valide. */
export async function validerProfil(formData: FormData) {
  const { supabase, brand } = await laMarque();
  if (!brand) redirect("/bienvenue?err=Compte%20introuvable");

  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");
  const { error } = await supabase
    .from("brands")
    .update({
      name: String(formData.get("nom") ?? brand.name).trim() || brand.name,
      handle: handle || null,
      website: String(formData.get("site") ?? "").trim() || null,
      city: String(formData.get("ville") ?? "").trim() || null,
      brand_brief: {
        activite: String(formData.get("activite") ?? "").trim(),
        positionnement: String(formData.get("positionnement") ?? "").trim(),
        cible: String(formData.get("cible") ?? "").trim(),
        zone: String(formData.get("zone") ?? "").trim(),
        ton: String(formData.get("ton") ?? "").trim(),
        objectifs: String(formData.get("objectifs") ?? "").trim(),
        interdits: String(formData.get("interdits") ?? "").trim(),
        design: String(formData.get("design") ?? "").trim(),
      },
      onboarded: true,
    })
    .eq("id", brand.id);
  if (error) redirect(`/bienvenue?etape=2&err=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/bienvenue?etape=3");
}

/** Ajout ou correction d'une ligne de carte pendant le parcours d'entrée. */
export async function ajouterProduit(formData: FormData) {
  const { supabase, brand } = await laMarque();
  if (!brand) redirect("/bienvenue?err=Compte%20introuvable");
  const nom = String(formData.get("produit") ?? "").trim();
  if (nom) {
    await supabase.from("products").insert({
      brand_id: brand.id,
      name: nom.slice(0, 120),
      price_cents: centimes(String(formData.get("prix") ?? "")),
    });
  }
  revalidatePath("/bienvenue");
  redirect("/bienvenue?etape=2");
}

export async function retirerProduit(formData: FormData) {
  const { supabase } = await laMarque();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("products").delete().eq("id", id);
  revalidatePath("/bienvenue");
  redirect("/bienvenue?etape=2");
}

/** Fin du parcours : on entre dans l'application. */
export async function terminer() {
  const { supabase, brand } = await laMarque();
  if (brand) await supabase.from("brands").update({ onboarded: true }).eq("id", brand.id);
  revalidatePath("/", "layout");
  redirect("/tableau?ok=Bienvenue%20%21%20Votre%20espace%20est%20pr%C3%AAt");
}
