"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { dechiffrer } from "@/lib/crypto";
import { JOURS, MOIS, iso } from "@/lib/semaine";
import { THEMES } from "@/lib/story";
import { jourImageElement } from "@/lib/jour-image";
import { rendreElement } from "@/lib/story-render";
import { publierPhotoFacebook, publierStoryInstagram } from "@/lib/meta";

/** Date d'aujourd'hui à Paris, au format AAAA-MM-JJ. */
function aujourdhuiParis(): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
}

export async function publierStoryDuJour(formData: FormData) {
  const media = (formData.get("media") as string) || null;
  const theme = String(formData.get("theme") ?? "vert");
  const meteo = String(formData.get("meteo") ?? "");
  const cibles = [
    formData.get("instagram") === "on" ? "instagram" : null,
    formData.get("facebook") === "on" ? "facebook" : null,
  ].filter(Boolean) as string[];
  const retour = (p: string) => redirect(`/jour?${p}`);
  if (!cibles.length) retour("err=Choisissez%20au%20moins%20un%20r%C3%A9seau");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) retour("err=Marque%20introuvable");

  try {
    const jour = aujourdhuiParis();
    const { data: slots } = await supabase
      .from("location_schedule")
      .select("service, time_range, note, status")
      .eq("brand_id", brandId!)
      .eq("day", iso(jour))
      .neq("status", "cancelled")
      .order("service");

    const services = (slots ?? []).map((s) => ({
      label: s.service === "midi" ? "MIDI" : "SOIR",
      lieu: s.note ?? "",
      horaires: s.time_range ?? "",
    }));

    const indice = (jour.getUTCDay() + 6) % 7;
    const image = await rendreElement(
      jourImageElement({
        theme: THEMES[theme] ?? THEMES.vert,
        jourLong: JOURS[indice],
        dateCourte: `${jour.getUTCDate()} ${MOIS[jour.getUTCMonth()]}`,
        services,
        photoUrl: media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null,
        meteo: meteo || undefined,
      })
    );
    const png = Buffer.from(await image.arrayBuffer());

    const chemin = `${brandId}/jour/${iso(jour)}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("media")
      .upload(chemin, png, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);
    const url = supabase.storage.from("media").getPublicUrl(chemin).data.publicUrl;

    const legende =
      services.length === 0
        ? "Le camion se repose aujourd'hui, on recharge les woks 🍜"
        : `📍 Aujourd'hui, ${services.map((s) => `${s.label.toLowerCase()} ${s.lieu} (${s.horaires})`).join(" et ")}. On vous attend 🍜`;

    const { data: comptes } = await supabase
      .from("social_accounts")
      .select("platform, external_id, encrypted_credentials")
      .eq("brand_id", brandId!);
    const resultats: { platform: string; status: string; remote_id?: string; error?: string }[] = [];

    for (const cible of cibles) {
      const c = (comptes ?? []).find((x) => x.platform === cible);
      if (!c) {
        resultats.push({ platform: cible, status: "failed", error: "compte non connecté" });
        continue;
      }
      try {
        const jeton = dechiffrer(String(c.encrypted_credentials));
        const id =
          cible === "instagram"
            ? await publierStoryInstagram(String(c.external_id), jeton, url)
            : await publierPhotoFacebook(String(c.external_id), jeton, url, legende);
        resultats.push({ platform: cible, status: "published", remote_id: id });
      } catch (e) {
        resultats.push({ platform: cible, status: "failed", error: e instanceof Error ? e.message : "échec" });
      }
    }

    await supabase.from("publication_log").insert(
      resultats.map((r) => ({
        brand_id: brandId!,
        platform: r.platform,
        kind: "jour",
        status: r.status,
        remote_id: r.remote_id ?? null,
        caption: legende,
        media_url: url,
        error: r.error ?? null,
      }))
    );

    revalidatePath("/jour");
    revalidatePath("/journal");
    const echecs = resultats.filter((r) => r.status === "failed");
    if (echecs.length) retour(`err=${encodeURIComponent(echecs.map((e) => `${e.platform} : ${e.error}`).join(" · "))}`);
    retour(`ok=${encodeURIComponent(`Story du jour publiée sur ${resultats.map((r) => r.platform).join(" et ")}`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "publication impossible")}`);
  }
}

/** Signale une rupture depuis l'écran du matin, sans passer par Ma marque. */
export async function basculerRupture(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  const rupture = String(formData.get("rupture") ?? "false") === "true";
  if (id) await supabase.from("products").update({ out_of_stock: !rupture }).eq("id", id);
  revalidatePath("/jour");
  revalidatePath("/marque");
}
