"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const COTE_MAX = 2000;
const POIDS_CIBLE = 1_200_000;

/** Même réduction que sur l'écran Story : le téléphone allège avant d'envoyer. */
async function preparer(file: File): Promise<{ blob: Blob; ext: string }> {
  try {
    if (file.size <= POIDS_CIBLE && file.type === "image/jpeg") return { blob: file, ext: "jpg" };
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

/** Envoi de plusieurs photos d'un coup, directement au stockage. */
export default function Televerseur({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [encours, setEncours] = useState(0);
  const [total, setTotal] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    if (!fichiers.length) return;
    setErreur(null);
    setTotal(fichiers.length);
    setEncours(0);
    const supabase = supabaseBrowser();

    for (const [i, file] of fichiers.entries()) {
      try {
        const { blob, ext } = await preparer(file);
        const chemin = `${brandId}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(chemin, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase
          .from("media_assets")
          .insert({ brand_id: brandId, storage_path: chemin, kind: "photo", ai_tags: [] });
        if (insErr) throw new Error(insErr.message);
        setEncours(i + 1);
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "envoi impossible");
        break;
      }
    }

    setTotal(0);
    e.target.value = "";
    router.refresh();
  }

  const travaille = total > 0;

  return (
    <div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <span
          className={`text-sm rounded-lg px-4 py-2 font-semibold text-white ${
            travaille ? "bg-gray-400" : "bg-[#0f6b53] hover:opacity-90"
          }`}
        >
          {travaille ? `Envoi ${encours}/${total}…` : "Importer des photos"}
        </span>
        <input type="file" accept="image/*" multiple className="hidden" disabled={travaille} onChange={envoyer} />
      </label>
      <p className="text-xs text-gray-500 mt-2">
        Plusieurs photos à la fois, réduites automatiquement dans votre téléphone avant l&apos;envoi. Elles servent
        partout : stories, calendrier, studio.
      </p>
      {erreur && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
          Envoi impossible : {erreur}
        </p>
      )}
    </div>
  );
}
