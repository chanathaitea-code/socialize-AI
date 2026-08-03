"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { construireRapport, premierDuMois } from "@/lib/rapport";

/** Fabrique (ou refait) le rapport d'un mois et le conserve. */
export async function genererRapport(formData: FormData) {
  const decalage = parseInt(String(formData.get("decalage") ?? "-1"), 10) || -1;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect("/rapport?err=Marque%20introuvable");

  try {
    const mois = premierDuMois(decalage);
    const rapport = await construireRapport(supabase, brandId!, mois);
    const { error } = await supabase
      .from("monthly_reports")
      .upsert({ brand_id: brandId, mois: rapport.mois, contenu: rapport }, { onConflict: "brand_id,mois" });
    if (error) redirect(`/rapport?err=${encodeURIComponent(error.message)}`);
    revalidatePath("/rapport");
    redirect(`/rapport?m=${decalage}&ok=${encodeURIComponent(`Rapport de ${rapport.intitule} établi`)}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    redirect(`/rapport?err=${encodeURIComponent(e instanceof Error ? e.message : "rapport impossible")}`);
  }
}
