"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function brandId() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("brands").select("id").limit(1);
  return { supabase, id: (data?.[0]?.id as string | undefined) ?? null };
}

export async function saveBrand(formData: FormData) {
  const { supabase, id } = await brandId();
  if (!id) redirect("/marque?err=Marque%20introuvable");

  // Le brief porte aussi des champs écrits sur d'autres écrans, le design par
  // exemple : les conserver, sinon enregistrer le profil les effacerait.
  const { data: actuel } = await supabase.from("brands").select("brand_brief").eq("id", id).maybeSingle();
  const brief = {
    ...((actuel?.brand_brief ?? {}) as Record<string, string>),
    activite: String(formData.get("activite") ?? "").trim(),
    positionnement: String(formData.get("positionnement") ?? "").trim(),
    cible: String(formData.get("cible") ?? "").trim(),
    ton: String(formData.get("ton") ?? "").trim(),
    zone: String(formData.get("zone") ?? "").trim(),
    objectifs: String(formData.get("objectifs") ?? "").trim(),
    interdits: String(formData.get("interdits") ?? "").trim(),
  };

  const { error } = await supabase
    .from("brands")
    .update({ name: String(formData.get("nom") ?? "").trim() || "Ma marque", brand_brief: brief })
    .eq("id", id);
  if (error) redirect(`/marque?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/marque");
  redirect("/marque?ok=Profil%20enregistr%C3%A9");
}

export async function addProduct(formData: FormData) {
  const { supabase, id } = await brandId();
  if (!id) redirect("/marque?err=Marque%20introuvable");
  const nom = String(formData.get("nom") ?? "").trim();
  const prix = String(formData.get("prix") ?? "").replace(",", ".").trim();
  if (!nom) redirect("/marque?err=Indiquez%20un%20nom");
  const cents = prix ? Math.round(parseFloat(prix) * 100) : null;
  const { error } = await supabase.from("products").insert({ brand_id: id, name: nom, price_cents: cents });
  if (error) redirect(`/marque?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/marque");
}

export async function deleteProduct(formData: FormData) {
  const { supabase } = await brandId();
  const pid = String(formData.get("id") ?? "");
  if (pid) await supabase.from("products").delete().eq("id", pid);
  revalidatePath("/marque");
}

export async function toggleStock(formData: FormData) {
  const { supabase } = await brandId();
  const pid = String(formData.get("id") ?? "");
  const rupture = String(formData.get("rupture") ?? "false") === "true";
  if (pid) await supabase.from("products").update({ out_of_stock: !rupture }).eq("id", pid);
  revalidatePath("/marque");
}

const CARTE_FOOD_TRUCK: { name: string; price: number }[] = [
  { name: "Nems thaï légume (x3)", price: 6 },
  { name: "Nems poulet (x3)", price: 6 },
  { name: "Nems porc (x3)", price: 6 },
  { name: "Pad Thaï poulet", price: 13 },
  { name: "Pad Thaï bœuf", price: 14 },
  { name: "Pad Thaï veggie", price: 12 },
  { name: "Crousty Thaï", price: 13 },
  { name: "Panang Poulet Coco", price: 13 },
  { name: "Bubble Tea Premium", price: 6.5 },
  { name: "Menu entrée + plat", price: 16 },
  { name: "Menu plat + boisson", price: 15 },
  { name: "Menu plat + bubble tea", price: 19 },
];

export async function prefillCarte() {
  const { supabase, id } = await brandId();
  if (!id) redirect("/marque?err=Marque%20introuvable");
  const { data: existing } = await supabase.from("products").select("name");
  const noms = new Set((existing ?? []).map((p) => p.name));
  const rows = CARTE_FOOD_TRUCK.filter((p) => !noms.has(p.name)).map((p) => ({
    brand_id: id,
    name: p.name,
    price_cents: Math.round(p.price * 100),
  }));
  if (rows.length) {
    const { error } = await supabase.from("products").insert(rows);
    if (error) redirect(`/marque?err=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/marque");
  redirect(`/marque?ok=${rows.length}%20produits%20ajout%C3%A9s`);
}
