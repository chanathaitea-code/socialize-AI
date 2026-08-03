"use client";

import { useState } from "react";
import { GABARITS, type Gabarit } from "@/lib/gabarits";

type Photo = { chemin: string; url: string };
type Plat = { nom: string; prix: string };

const LIBELLE: Record<string, Record<string, string>> = {
  plat: { titre: "Nom du plat", prix: "Prix affiché", sous: "La phrase qui donne envie" },
  avis: { texte: "L’avis, mot pour mot", auteur: "Signé (prénom, ou « un client »)" },
  coulisses: { titre: "Titre", sous: "Ce qu’on voit sur la photo" },
  rebours: { titre: "Le gros texte", sous: "La précision en dessous", lieu: "Où et à quelle heure" },
};

const EXEMPLE: Record<string, Record<string, string>> = {
  plat: { titre: "Pad Thaï poulet", prix: "10,50 €", sous: "Wok minute, cacahuètes torréfiées, citron vert." },
  avis: { texte: "Le meilleur pad thaï que j'ai mangé en région parisienne, et l'accueil est adorable.", auteur: "Julie, Montigny" },
  coulisses: { titre: "6h du matin", sous: "On découpe, on marine, on prépare les sauces avant l'ouverture." },
  rebours: { titre: "DANS 1H", sous: "Le camion ouvre", lieu: "Place des Nymphes · 11h30-14h" },
};

export default function Formulaire({
  gabarit,
  photos,
  plats,
  lieuDuJour,
  themes,
  defautQuand,
  publier,
  initial,
}: {
  gabarit: Gabarit;
  photos: Photo[];
  plats: Plat[];
  lieuDuJour: string;
  themes: { cle: string; nom: string }[];
  defautQuand: string;
  publier: (fd: FormData) => void;
  initial?: Record<string, string | undefined>;
}) {
  const def = EXEMPLE[gabarit] ?? {};
  // Les champs peuvent arriver pré-remplis depuis le calendrier éditorial.
  const [champs, setChamps] = useState<Record<string, string>>({
    titre: initial?.titre ?? "",
    sous: initial?.sous ?? "",
    prix: initial?.prix ?? "",
    texte: initial?.texte ?? "",
    auteur: initial?.auteur ?? "",
    lieu: initial?.lieu ?? (gabarit === "rebours" ? lieuDuJour : ""),
  });
  const [theme, setTheme] = useState("vert");
  const [media, setMedia] = useState(photos[0]?.chemin ?? "");
  // L'aperçu ne se recalcule pas à chaque frappe : on le fige, et il se
  // rafraîchit quand on quitte un champ ou qu'on change de thème ou de photo.
  const [vu, setVu] = useState(0);

  const utilise = GABARITS[gabarit].champs;
  const avecPhoto = utilise.includes("photo");

  const parametres = new URLSearchParams({ g: gabarit, theme });
  for (const [k, v] of Object.entries(champs)) if (v) parametres.set(k, v);
  if (avecPhoto && media) parametres.set("media", media);
  parametres.set("v", String(vu));
  const apercu = `/stories/image?${parametres.toString()}`;
  const telechargement = `${apercu}&dl=1`;

  const modifier = (cle: string, valeur: string) => setChamps((c) => ({ ...c, [cle]: valeur }));

  return (
    <div className="mt-6 grid md:grid-cols-[1fr_320px] gap-6 items-start">
      <form action={publier} className="bg-white border border-gray-200 rounded-xl p-5 grid gap-4">
        <input type="hidden" name="gabarit" value={gabarit} />
        <input type="hidden" name="theme" value={theme} />
        {avecPhoto && <input type="hidden" name="media" value={media} />}

        {gabarit === "plat" && plats.length > 0 && (
          <label className="text-sm">
            <span className="block font-semibold text-[#12211c] mb-1">Prendre dans votre carte</span>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              defaultValue=""
              onChange={(e) => {
                const p = plats.find((x) => x.nom === e.target.value);
                if (p) {
                  setChamps((c) => ({ ...c, titre: p.nom, prix: p.prix }));
                  setVu((v) => v + 1);
                }
              }}
            >
              <option value="">— choisir un plat —</option>
              {plats.map((p) => (
                <option key={p.nom} value={p.nom}>
                  {p.nom} {p.prix && `· ${p.prix}`}
                </option>
              ))}
            </select>
          </label>
        )}

        {utilise
          .filter((c) => c !== "photo")
          .map((cle) => {
            const long = cle === "texte" || cle === "sous";
            return (
              <label key={cle} className="text-sm">
                <span className="block font-semibold text-[#12211c] mb-1">
                  {LIBELLE[gabarit]?.[cle] ?? cle}
                </span>
                {long ? (
                  <textarea
                    name={cle}
                    rows={cle === "texte" ? 4 : 2}
                    value={champs[cle]}
                    placeholder={def[cle] ?? ""}
                    onChange={(e) => modifier(cle, e.target.value)}
                    onBlur={() => setVu((v) => v + 1)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                ) : (
                  <input
                    name={cle}
                    value={champs[cle]}
                    placeholder={def[cle] ?? ""}
                    onChange={(e) => modifier(cle, e.target.value)}
                    onBlur={() => setVu((v) => v + 1)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                )}
              </label>
            );
          })}

        <div className="text-sm">
          <span className="block font-semibold text-[#12211c] mb-2">Couleurs</span>
          <div className="flex gap-2 flex-wrap">
            {themes.map((t) => (
              <button
                key={t.cle}
                type="button"
                onClick={() => {
                  setTheme(t.cle);
                  setVu((v) => v + 1);
                }}
                className={`rounded-lg px-3 py-1.5 border text-xs ${
                  theme === t.cle ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"
                }`}
              >
                {t.nom}
              </button>
            ))}
          </div>
        </div>

        {avecPhoto && (
          <div className="text-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-semibold text-[#12211c]">Photo</span>
              <a href="/design" className="text-xs text-[#0f6b53] font-semibold underline">
                importer des photos
              </a>
            </div>
            {photos.length === 0 ? (
              <p className="text-xs text-gray-500">
                Aucune photo dans la bibliothèque. Elles s&apos;importent depuis l&apos;écran Design, section « Vos
                photos », et servent ensuite partout.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {photos.map((p) => (
                  <button
                    key={p.chemin}
                    type="button"
                    onClick={() => {
                      setMedia(p.chemin);
                      setVu((v) => v + 1);
                    }}
                    className="p-0 border-0 bg-transparent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className={`w-14 h-14 object-cover rounded-lg border-2 ${
                        media === p.chemin ? "border-[#0f6b53]" : "border-gray-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 grid gap-3">
          <div className="flex gap-4 items-center flex-wrap text-sm">
            <select name="format" defaultValue="story" className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
              <option value="story">En story</option>
              <option value="post">Dans le fil</option>
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="instagram" defaultChecked className="w-4 h-4 accent-[#0f6b53]" />
              Instagram
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="facebook" className="w-4 h-4 accent-[#0f6b53]" />
              Facebook
            </label>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <button
              name="mode"
              value="maintenant"
              className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Publier tout de suite
            </button>
            <span className="text-sm text-gray-400">ou</span>
            <input
              type="datetime-local"
              name="quand"
              defaultValue={defautQuand}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              name="mode"
              value="plus-tard"
              className="border border-[#0f6b53] text-[#0f6b53] rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#e5f2ee]"
            >
              Programmer
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Un envoi programmé reste annulable depuis le Journal jusqu&apos;à l&apos;heure choisie.
          </p>
        </div>
      </form>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:sticky md:top-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Aperçu</span>
          <button
            type="button"
            onClick={() => setVu((v) => v + 1)}
            className="text-xs text-[#0f6b53] font-semibold"
          >
            Rafraîchir
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={apercu} alt="Aperçu de la story" className="w-full rounded-lg border border-gray-200" />
        <a
          href={telechargement}
          className="block text-center mt-3 text-xs border border-gray-300 rounded-lg px-3 py-2 text-gray-600 hover:border-[#0f6b53] hover:text-[#0f6b53]"
        >
          Télécharger l&apos;image
        </a>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{GABARITS[gabarit].conseil}</p>
      </div>
    </div>
  );
}
