"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { depuisSaisieParis, iso, mondayOf } from "@/lib/semaine";
import { unTheme } from "@/lib/design";
import { rendreElement } from "@/lib/story-render";
import { gabaritElement, legendeGabarit, type Gabarit } from "@/lib/gabarits";
import { publierMedia } from "@/lib/publier-media";

/**
 * Une story de gabarit part comme n'importe quelle photo : on fabrique l'image,
 * on la dépose au stockage, puis on la publie tout de suite ou à l'heure dite.
 */
export async function publierGabarit(formData: FormData) {
  const gabarit = (String(formData.get("gabarit") ?? "plat") || "plat") as Gabarit;
  const themeCle = String(formData.get("theme") ?? "vert");
  const media = (formData.get("media") as string) || null;
  const format = String(formData.get("format") ?? "story");
  const mode = String(formData.get("mode") ?? "maintenant");
  const quand = String(formData.get("quand") ?? "");
  const cibles = [
    formData.get("instagram") === "on" ? "instagram" : null,
    formData.get("facebook") === "on" ? "facebook" : null,
  ].filter(Boolean) as string[];

  const champs = {
    titre: (formData.get("titre") as string) || undefined,
    sous: (formData.get("sous") as string) || undefined,
    prix: (formData.get("prix") as string) || undefined,
    texte: (formData.get("texte") as string) || undefined,
    auteur: (formData.get("auteur") as string) || undefined,
    lieu: (formData.get("lieu") as string) || undefined,
  };

  const retour = (p: string) => redirect(`/stories?g=${gabarit}&${p}`);
  if (!cibles.length) retour("err=Choisissez%20au%20moins%20un%20r%C3%A9seau");
  if (gabarit === "avis" && !champs.texte) retour("err=Recopiez%20l%27avis%20avant%20de%20publier");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) retour("err=Marque%20introuvable");

  try {
    const photoUrl = media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null;
    const image = await rendreElement(
      gabaritElement(gabarit, await unTheme(supabase, brandId, themeCle), { ...champs, photoUrl })
    );
    const png = Buffer.from(await image.arrayBuffer());

    const chemin = `${brandId}/gabarits/${gabarit}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(chemin, png, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const legende = legendeGabarit(gabarit, champs);

    if (mode === "maintenant") {
      const resultats = await publierMedia(supabase, {
        brandId: brandId!,
        mediaPath: chemin,
        legende,
        cibles,
        format,
      });
      revalidatePath("/journal");
      const echecs = resultats.filter((r) => r.status === "failed");
      if (echecs.length) retour(`err=${encodeURIComponent(echecs.map((e) => `${e.platform} : ${e.error}`).join(" · "))}`);
      retour(`ok=${encodeURIComponent(`Publiée sur ${resultats.map((r) => r.platform).join(" et ")}`)}`);
    }

    const depart = quand ? depuisSaisieParis(quand) : new Date(Date.now() + 10 * 60_000);
    if (Number.isNaN(depart.getTime())) retour("err=Date%20invalide");
    const { error } = await supabase.from("story_jobs").insert({
      brand_id: brandId,
      run_at: depart.toISOString(),
      monday: iso(mondayOf(0)),
      kind: "photo",
      format,
      media_path: chemin,
      caption: legende,
      targets: cibles,
      origin: "gabarit",
    });
    if (error) retour(`err=${encodeURIComponent(error.message)}`);
    revalidatePath("/journal");
    retour(
      `ok=${encodeURIComponent(
        `Programmée le ${depart.toLocaleString("fr-FR", {
          timeZone: "Europe/Paris",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}, annulable depuis le Journal`
      )}`
    );
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "publication impossible")}`);
  }
}
