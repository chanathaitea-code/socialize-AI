"use client";

import { useState } from "react";
import { updateContactName } from "./actions";

/**
 * Nom du responsable, éditable en un clic depuis la fiche. Simple bascule
 * texte ↔ champ de saisie ; l'enregistrement passe par une action serveur.
 */
export default function NomResponsable({
  opportunityId,
  initial,
}: {
  opportunityId: string;
  initial: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <p className="mt-2 text-sm">
        <span className="text-gray-500">Responsable : </span>
        <span className="font-semibold text-[#12211c]">
          {initial || "non renseigné"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-2 text-[#0f6b53] underline underline-offset-2"
        >
          {initial ? "modifier" : "ajouter"}
        </button>
      </p>
    );
  }

  return (
    <form
      action={updateContactName}
      onSubmit={() => setEditing(false)}
      className="mt-2 flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={opportunityId} />
      <input
        name="contact_name"
        defaultValue={initial ?? ""}
        autoFocus
        placeholder="Nom du responsable"
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-[#0f6b53] px-3 py-1 text-sm font-semibold text-white hover:opacity-90"
      >
        Enregistrer
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-sm text-gray-500 underline underline-offset-2"
      >
        Annuler
      </button>
    </form>
  );
}
