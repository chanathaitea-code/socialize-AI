"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { genererFond, proposerThemes } from "@/lib/design";

async function laMarque() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("brands").select("id, name, brand_brief").limit(1);
  return { supabase, brand: data?.[0] ?? null };
}

const retour = (p: string) => redirect(`/design${p ? `?${p}` : ""}`);

/** Enregistre, en français, l'allure que doit avoir la communication. */
export async function enregistrerDesign(formData: FormData) {
  const { supabase, brand } = await laMarque();
  if (!brand) retour("err=Marque%20introuvable");
  const design = String(formData.get("design") ?? "").trim();
  const brief = { ...((brand!.brand_brief ?? {}) as Record<string, string>), design };
  const { error } = await supabase.from("brands").update({ brand_brief: brief }).eq("id", brand!.id);
  if (error) retour(`err=${encodeURIComponent(error.message)}`);
  revalidatePath("/design");
  retour("ok=Design%20enregistr%C3%A9");
}

/** Trois chartes de couleurs écrites à partir de la description. */
export async function proposerChartes(formData: FormData) {
  const { supabase, brand } = await laMarque();
  if (!brand) retour("err=Marque%20introuvable");
  const brief = (brand!.brand_brief ?? {}) as Record<string, string>;
  const description = String(formData.get("design") ?? brief.design ?? "").trim();
  if (!description) retour("err=D%C3%A9crivez%20d%27abord%20le%20design%20voulu");

  try {
    // On enregistre la description au passage : c'est elle qui sert de mémoire.
    await supabase
      .from("brands")
      .update({ brand_brief: { ...brief, design: description } })
      .eq("id", brand!.id);

    const themes = await proposerThemes(description, String(brand!.name ?? "Chana Thaï"));
    if (!themes.length) retour("err=Le%20mod%C3%A8le%20n%27a%20rien%20propos%C3%A9%20d%27utilisable");

    const base = Date.now().toString(36).slice(-4);
    const lignes = themes.map((t, i) => ({
      brand_id: brand!.id,
      cle: `p${base}${i}`,
      nom: t.nom,
      bg: t.bg,
      accent: t.accent,
      photo: t.photo,
      source: "ia",
    }));
    const { error } = await supabase.from("brand_themes").insert(lignes);
    if (error) retour(`err=${encodeURIComponent(error.message)}`);
    revalidatePath("/design");
    revalidatePath("/stories");
    retour(`ok=${encodeURIComponent(`${lignes.length} chartes ajoutées à vos couleurs`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "proposition impossible")}`);
  }
}

/** Retire une charte de couleurs. */
export async function supprimerCharte(formData: FormData) {
  const { supabase } = await laMarque();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("brand_themes").delete().eq("id", id);
  revalidatePath("/design");
  revalidatePath("/stories");
  retour("");
}

/** Retire une photo de la bibliothèque (le fichier reste au stockage). */
export async function supprimerPhoto(formData: FormData) {
  const { supabase } = await laMarque();
  const id = String(formData.get("id") ?? "");
  const chemin = String(formData.get("chemin") ?? "");
  if (id) await supabase.from("media_assets").delete().eq("id", id);
  if (chemin) await supabase.storage.from("media").remove([chemin]);
  revalidatePath("/design");
  retour("ok=Photo%20retir%C3%A9e");
}

/**
 * Fond fabriqué par l'IA, éventuellement à partir d'une de vos photos, puis
 * rangé dans la bibliothèque comme n'importe quelle image.
 */
export async function fabriquerFond(formData: FormData) {
  const { supabase, brand } = await laMarque();
  if (!brand) retour("err=Marque%20introuvable");
  const brief = (brand!.brand_brief ?? {}) as Record<string, string>;
  const consigne = String(formData.get("consigne") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  if (!consigne) retour("err=D%C3%A9crivez%20l%27image%20voulue");

  try {
    let ref: { base64: string; mime: string } | undefined;
    if (reference) {
      const { data, error } = await supabase.storage.from("media").download(reference);
      if (!error && data) {
        const buf = Buffer.from(await data.arrayBuffer());
        ref = { base64: buf.toString("base64"), mime: data.type || "image/jpeg" };
      }
    }

    const image = await genererFond(
      `${consigne}${brief.design ? `\nStyle de la marque : ${brief.design}` : ""}`,
      ref
    );
    const chemin = `${brand!.id}/fonds/${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(chemin, image, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);

    await supabase
      .from("media_assets")
      .insert({ brand_id: brand!.id, storage_path: chemin, kind: "photo", ai_tags: ["fond-ia"] });

    revalidatePath("/design");
    revalidatePath("/stories");
    retour("ok=Fond%20fabriqu%C3%A9%20et%20rang%C3%A9%20dans%20vos%20photos");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "génération impossible")}`);
  }
}
