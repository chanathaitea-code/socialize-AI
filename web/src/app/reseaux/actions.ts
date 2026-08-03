"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function deconnecter(formData: FormData) {
  const supabase = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("social_accounts").delete().eq("id", id);
  if (error) redirect(`/reseaux?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/reseaux");
  redirect("/reseaux?ok=Compte%20d%C3%A9connect%C3%A9");
}
