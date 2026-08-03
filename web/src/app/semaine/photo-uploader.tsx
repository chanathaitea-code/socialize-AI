"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const COTE_MAX = 2000; // pixels sur le plus grand côté
const POIDS_CIBLE = 1_200_000; // au-delà, on recompresse

/**
 * Réduit la photo dans le navigateur avant l'envoi : une photo de téléphone de
 * 5 Mo devient un JPEG de 300 à 500 Ko, largement suffisant pour une story.
 * En cas d'échec (format exotique type HEIC), on envoie le fichier tel quel :
 * l'envoi va directement au stockage, il n'y a plus de limite de 4,5 Mo.
 */
async function preparer(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    if (file.size <= POIDS_CIBLE && file.type === "image/jpeg") {
      return { blob: file, ext: "jpg" };
    }
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponible");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("compression impossible");
    return { blob, ext: "jpg" };
  } catch {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    return { blob: file, ext };
  }
}

export default function PhotoUploader({
  brandId,
  theme,
  semaine,
}: {
  brandId: string;
  theme: string;
  semaine: "cur" | "next";
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "travail">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErreur(null);
    setEtat("travail");
    try {
      const { blob, ext } = await preparer(file);
      const chemin = `${brandId}/${Date.now()}.${ext}`;
      const supabase = supabaseBrowser();

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(chemin, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await supabase
        .from("media_assets")
        .insert({ brand_id: brandId, storage_path: chemin, kind: "photo", ai_tags: [] });
      if (insErr) throw new Error(insErr.message);

      const url = `/semaine?theme=${theme}&media=${encodeURIComponent(chemin)}${semaine === "next" ? "&s=next" : ""}`;
      router.push(url);
      router.refresh();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setEtat("repos");
      e.target.value = "";
    }
  }

  return (
    <div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span
          className={`text-sm rounded-lg px-3 py-1.5 font-semibold text-white ${
            etat === "travail" ? "bg-gray-400" : "bg-[#0f6b53] hover:opacity-90"
          }`}
        >
          {etat === "travail" ? "Envoi en cours..." : "Choisir une photo"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={etat === "travail"}
          onChange={envoyer}
        />
      </label>
      <p className="text-xs text-gray-500 mt-2">
        La photo est réduite automatiquement dans votre téléphone avant l&apos;envoi : plus besoin de se soucier du poids.
      </p>
      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
          Envoi impossible : {erreur}
        </p>
      )}
    </div>
  );
}
