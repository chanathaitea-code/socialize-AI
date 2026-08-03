"use client";

import { useState } from "react";

/**
 * Le pont vers ChatGPT : on écrit la consigne complète, il ne reste qu'à la
 * coller. Le format vertical et l'interdiction d'écrire du texte dans l'image
 * sont dedans, ce sont les deux choses qu'on oublie toujours.
 */
export default function Consigne({ style, marque }: { style: string; marque: string }) {
  const [sujet, setSujet] = useState("");
  const [copie, setCopie] = useState(false);

  const texte = [
    `Image verticale 9:16 (1080 × 1920 pixels) pour une story Instagram de ${marque}, food truck de street food thaïlandaise en Île-de-France.`,
    "",
    `Sujet : ${sujet.trim() || "un plat thaïlandais fumant, vu de près"}`,
    "",
    style.trim() ? `Style voulu : ${style.trim()}` : "Style : photographie réaliste, lumière naturelle, rendu appétissant.",
    "",
    "Contraintes :",
    "— aucun texte, aucun logo, aucun filigrane dans l'image ;",
    "— cadrage vertical strict, le sujet centré dans la moitié haute ;",
    "— zones calmes en haut et en bas, du texte sera ajouté par-dessus ensuite ;",
    "— rendu photographique réaliste, pas d'illustration ni de rendu 3D ;",
    "— pas de mains ni de visages en gros plan.",
    "",
    "Renvoie une seule image.",
  ].join("\n");

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setCopie(false);
    }
  }

  return (
    <div className="grid gap-3 mt-4">
      <label className="text-sm">
        <span className="block font-semibold text-[#12211c] mb-1">Ce que vous voulez voir sur l&apos;image</span>
        <textarea
          rows={2}
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Un pad thaï fumant sur une table en bois sombre, baguettes posées à côté, fin de journée."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </label>

      <div className="rounded-lg bg-[#f7f7f4] border border-gray-200 p-3">
        <pre className="text-xs text-[#12211c] whitespace-pre-wrap font-sans leading-relaxed">{texte}</pre>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <button
          type="button"
          onClick={copier}
          className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          {copie ? "Copié ✓" : "Copier la consigne"}
        </button>
        <a
          href="https://chatgpt.com/"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#0f6b53] font-semibold underline"
        >
          Ouvrir ChatGPT
        </a>
      </div>
    </div>
  );
}
