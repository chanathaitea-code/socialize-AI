"use client";

import { useState } from "react";

/**
 * Recherche du numéro d'une entreprise, à l'affichage seulement.
 *
 * Le numéro vit dans l'état du composant : il s'affiche après le clic et
 * disparaît au rechargement. Il n'est jamais renvoyé en base ni exporté —
 * contrainte de licence Google Places. Le déclencheur est ce clic humain.
 */
type Etat =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "found"; phone: string; website: string | null }
  | { s: "none"; website: string | null }
  | { s: "error"; message: string };

export default function TelephoneBouton({ opportunityId }: { opportunityId: string }) {
  const [etat, setEtat] = useState<Etat>({ s: "idle" });

  async function chercher() {
    setEtat({ s: "loading" });
    try {
      const res = await fetch("/api/prospection/telephone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: opportunityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEtat({ s: "error", message: data?.erreur ?? "recherche impossible" });
        return;
      }
      if (data.phone) {
        setEtat({ s: "found", phone: data.phone, website: data.website ?? null });
      } else {
        setEtat({ s: "none", website: data.website ?? null });
      }
    } catch {
      setEtat({ s: "error", message: "recherche impossible" });
    }
  }

  if (etat.s === "found") {
    return (
      <a
        href={`tel:${etat.phone.replace(/\s/g, "")}`}
        className="rounded-lg bg-[#0f6b53] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Appeler {etat.phone}
      </a>
    );
  }

  if (etat.s === "none") {
    return (
      <span className="text-sm text-gray-500">
        Aucun numéro public.{" "}
        {etat.website ? (
          <a
            href={etat.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0f6b53] underline underline-offset-2"
          >
            Voir le site de l&apos;établissement
          </a>
        ) : (
          "Passer par le site ou une visite."
        )}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      <button
        type="button"
        onClick={chercher}
        disabled={etat.s === "loading"}
        className="rounded-lg border border-[#0f6b53] px-4 py-2 text-sm font-semibold text-[#0f6b53] hover:bg-[#f7fbf9] disabled:opacity-60"
      >
        {etat.s === "loading" ? "Recherche…" : "Trouver le numéro"}
      </button>
      {etat.s === "error" && (
        <span className="text-sm text-red-700">{etat.message}</span>
      )}
    </span>
  );
}
