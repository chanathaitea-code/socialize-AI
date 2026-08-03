"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { rafraichirMesures } from "@/lib/insights";

export async function actualiser() {
  const supabase = await supabaseServer();
  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) redirect("/analyse?err=Marque%20introuvable");

  try {
    const n = await rafraichirMesures(supabase, brandId, 7);
    revalidatePath("/analyse");
    redirect(`/analyse?ok=${n}%20publication(s)%20actualis%C3%A9e(s)`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(`/analyse?err=${encodeURIComponent(e instanceof Error ? e.message : "actualisation impossible")}`);
  }
}
