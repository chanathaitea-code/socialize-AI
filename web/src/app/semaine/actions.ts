"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function uploadPhoto(formData: FormData) {
  const supabase = await supabaseServer();
  const file = formData.get("file") as File | null;
  const theme = String(formData.get("theme") ?? "vert");
  const semaine = String(formData.get("s") ?? "cur");

  if (!file || file.size === 0) redirect(`/semaine?theme=${theme}&err=Choisissez%20une%20photo`);
  if (file.size > 8 * 1024 * 1024) redirect(`/semaine?theme=${theme}&err=Photo%20trop%20lourde%20(8%20Mo%20max)`);

  const { data: brands, error: brandErr } = await supabase.from("brands").select("id").limit(1);
  if (brandErr || !brands?.[0]) redirect(`/semaine?theme=${theme}&err=Marque%20introuvable`);
  const brandId = brands[0].id as string;

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${brandId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (upErr) redirect(`/semaine?theme=${theme}&err=${encodeURIComponent(upErr.message)}`);

  await supabase.from("media_assets").insert({
    brand_id: brandId,
    storage_path: path,
    kind: "photo",
    ai_tags: [],
  });

  revalidatePath("/semaine");
  redirect(`/semaine?theme=${theme}&media=${encodeURIComponent(path)}${semaine === "next" ? "&s=next" : ""}`);
}

export async function deletePhoto(formData: FormData) {
  const supabase = await supabaseServer();
  const path = String(formData.get("path") ?? "");
  if (!path) return;
  await supabase.storage.from("media").remove([path]);
  await supabase.from("media_assets").delete().eq("storage_path", path);
  revalidatePath("/semaine");
  redirect("/semaine");
}
