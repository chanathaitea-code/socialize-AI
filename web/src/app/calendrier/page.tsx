import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { MOIS } from "@/lib/semaine";
import { premierDuMois } from "@/lib/rapport";
import Nav from "../nav";
import { changerStatutItem, etablirLigne, supprimerItem } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Item = {
  id: string;
  jour: string;
  format: string;
  gabarit: string | null;
  rubrique: string | null;
  objectif: string | null;
  accroche: string | null;
  texte: string | null;
  hashtags: string | null;
  conseil: string | null;
  alertes: string[] | null;
  statut: string;
};

const COULEUR: Record<string, { fond: string; texte: string; nom: string }> = {
  plat: { fond: "#e5f2ee", texte: "#0f6b53", nom: "Plat" },
  avis: { fond: "#fff3d6", texte: "#8a5a00", nom: "Avis" },
  coulisses: { fond: "#eae6fd", texte: "#4b2fa8", nom: "Coulisses" },
  rebours: { fond: "#fdeaf3", texte: "#a3266b", nom: "Rebours" },
  semaine: { fond: "#e2effb", texte: "#1c5b96", nom: "Semaine" },
  libre: { fond: "#efefec", texte: "#4a4a44", nom: "Libre" },
};

const GABARITS_STORY = new Set(["plat", "avis", "coulisses", "rebours"]);

/** Lien vers le studio de stories, champs déjà remplis par la ligne éditoriale. */
function lienStory(i: Item): string {
  const p = new URLSearchParams({ g: i.gabarit ?? "plat" });
  if (i.gabarit === "avis") {
    if (i.texte) p.set("texte", i.texte);
  } else {
    if (i.accroche) p.set("titre", i.accroche);
    if (i.texte) p.set("sous", i.texte);
  }
  return `/stories?${p.toString()}`;
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; err?: string; ok?: string }>;
}) {
  const { m, err, ok } = await searchParams;
  const decalage = Math.max(-1, Math.min(3, parseInt(m ?? "0", 10) || 0));

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mois = premierDuMois(decalage);
  const cle = mois.toISOString().slice(0, 10);
  const fin = new Date(mois);
  fin.setUTCMonth(fin.getUTCMonth() + 1);
  const finCle = fin.toISOString().slice(0, 10);
  const nbJours = Math.round((fin.getTime() - mois.getTime()) / 86_400_000);
  const decale = (mois.getUTCDay() + 6) % 7; // lundi en première colonne

  const [{ data: cap }, { data: brut }, { data: slots }, { data: partis }] = await Promise.all([
    supabase.from("editorial_months").select("theme, produit_phare, objectif, lecture").eq("mois", cle).maybeSingle(),
    supabase
      .from("editorial_items")
      .select("id, jour, format, gabarit, rubrique, objectif, accroche, texte, hashtags, conseil, alertes, statut")
      .eq("mois", cle)
      .neq("statut", "rejete")
      .order("jour"),
    supabase
      .from("location_schedule")
      .select("day, service, note, status")
      .gte("day", cle)
      .lt("day", finCle)
      .neq("status", "cancelled"),
    supabase
      .from("publication_log")
      .select("created_at, platform, status")
      .gte("created_at", mois.toISOString())
      .lt("created_at", fin.toISOString())
      .eq("status", "published"),
  ]);

  const items = (brut ?? []) as Item[];
  const parJour = new Map<number, Item[]>();
  for (const i of items) {
    const q = Number(i.jour.slice(8, 10));
    parJour.set(q, [...(parJour.get(q) ?? []), i]);
  }
  const servicesParJour = new Map<number, string[]>();
  for (const s of slots ?? []) {
    const q = Number(String(s.day).slice(8, 10));
    servicesParJour.set(q, [...(servicesParJour.get(q) ?? []), String(s.service)]);
  }
  const publieesParJour = new Map<number, number>();
  for (const p of partis ?? []) {
    const q = Number(String(p.created_at).slice(8, 10));
    publieesParJour.set(q, (publieesParJour.get(q) ?? 0) + 1);
  }

  const intitule = `${MOIS[mois.getUTCMonth()]} ${mois.getUTCFullYear()}`;
  const aujourdhui = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/calendrier" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h2 className="text-xl font-bold text-[#12211c] capitalize">Calendrier de {intitule}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Le cap du mois et ce qu&apos;on raconte, jour par jour, à partir de vos emplacements réels et de la
              saison. Rien ne part tout seul d&apos;ici : chaque contenu attend votre clic.
            </p>
          </div>
          <form action={etablirLigne}>
            <input type="hidden" name="decalage" value={decalage} />
            <button className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
              {items.length ? "Refaire le mois" : "Établir la ligne éditoriale"}
            </button>
          </form>
        </div>

        <div className="flex gap-2 mt-4 text-sm flex-wrap">
          {[-1, 0, 1, 2].map((d) => {
            const mo = premierDuMois(d);
            return (
              <Link
                key={d}
                href={`/calendrier?m=${d}`}
                className={`rounded-lg px-3 py-1.5 border capitalize ${
                  d === decalage ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"
                }`}
              >
                {MOIS[mo.getUTCMonth()]}
              </Link>
            );
          })}
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ {ok}
          </div>
        )}

        {cap?.theme && (
          <div className="mt-6 bg-white border border-[#c8e2da] rounded-xl p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#0f6b53] mb-2">Le cap du mois</div>
            <div className="text-lg font-bold text-[#12211c]">{cap.theme}</div>
            <div className="text-sm text-gray-500 mt-1">
              {cap.produit_phare && <>Produit mis en avant : {cap.produit_phare}. </>}
              {cap.objectif}
            </div>
            {cap.lecture && <p className="text-sm text-[#12211c] mt-3 leading-relaxed">{cap.lecture}</p>}
          </div>
        )}

        {/* Le mois d'un coup d'œil */}
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[640px]">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => (
              <div key={j} className="text-[11px] uppercase tracking-wide text-gray-400 font-bold px-2 py-1">
                {j}
              </div>
            ))}
            {Array.from({ length: decale }, (_, i) => (
              <div key={`vide-${i}`} />
            ))}
            {Array.from({ length: nbJours }, (_, i) => {
              const q = i + 1;
              const date = new Date(mois);
              date.setUTCDate(q);
              const estAujourdhui = date.toISOString().slice(0, 10) === aujourdhui;
              const services = servicesParJour.get(q) ?? [];
              return (
                <div
                  key={q}
                  className={`min-h-[92px] rounded-lg border p-1.5 ${
                    estAujourdhui ? "border-[#0f6b53] bg-[#f2f9f7]" : "border-gray-200 bg-[#fafaf8]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${estAujourdhui ? "text-[#0f6b53]" : "text-gray-500"}`}>{q}</span>
                    {services.length > 0 && (
                      <span className="text-[9px] uppercase font-bold text-gray-400">
                        {services.map((s) => s[0]).join("")}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1 mt-1">
                    {(parJour.get(q) ?? []).map((it) => {
                      const c = COULEUR[it.gabarit ?? "libre"] ?? COULEUR.libre;
                      return (
                        <div
                          key={it.id}
                          className="text-[9px] font-bold uppercase rounded px-1 py-0.5 truncate"
                          style={{ background: c.fond, color: c.texte }}
                          title={it.rubrique ?? c.nom}
                        >
                          {c.nom}
                        </div>
                      );
                    })}
                    {(publieesParJour.get(q) ?? 0) > 0 && (
                      <div className="text-[9px] text-gray-400">✓ {publieesParJour.get(q)} parti(s)</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Les initiales en haut à droite d&apos;une case rappellent vos services : M pour midi, S pour soir.
          </p>
        </div>

        {/* Le détail, contenu par contenu */}
        {items.length === 0 ? (
          <p className="mt-6 text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
            Aucune ligne éditoriale pour ce mois. Le bouton en haut à droite décide du cap et répartit huit à douze
            contenus sur le mois, en tenant compte de vos jours de service et de la saison.
          </p>
        ) : (
          <div className="mt-6 grid gap-3">
            {items.map((i) => {
              const c = COULEUR[i.gabarit ?? "libre"] ?? COULEUR.libre;
              const q = Number(i.jour.slice(8, 10));
              return (
                <div
                  key={i.id}
                  className={`bg-white border rounded-xl p-5 ${i.statut === "garde" ? "border-[#0f6b53]" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#12211c]">
                      {q} {MOIS[mois.getUTCMonth()]}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase rounded px-2 py-1"
                      style={{ background: c.fond, color: c.texte }}
                    >
                      {c.nom}
                    </span>
                    <span className="text-xs text-gray-400">{i.format}</span>
                    {i.objectif && <span className="text-xs text-gray-400">· {i.objectif}</span>}
                    {i.statut === "garde" && (
                      <span className="text-[10px] font-bold uppercase rounded px-2 py-1 bg-[#e5f2ee] text-[#0f6b53]">
                        gardé
                      </span>
                    )}
                  </div>

                  {i.rubrique && <div className="font-bold text-[#12211c] mt-3">{i.rubrique}</div>}
                  {i.accroche && <div className="text-sm font-semibold text-[#12211c] mt-2">{i.accroche}</div>}
                  {i.texte && <p className="text-sm text-[#12211c] mt-1 whitespace-pre-line leading-relaxed">{i.texte}</p>}
                  {i.hashtags && <p className="text-xs text-gray-400 mt-2">{i.hashtags}</p>}
                  {i.conseil && <p className="text-xs text-gray-500 mt-3 border-l-2 border-gray-200 pl-3">📸 {i.conseil}</p>}

                  {(i.alertes ?? []).length > 0 && (
                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      {(i.alertes ?? []).map((a, n) => (
                        <p key={n} className="text-xs text-amber-800">
                          ⚠ {a}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap items-center">
                    {GABARITS_STORY.has(i.gabarit ?? "") ? (
                      <Link
                        href={lienStory(i)}
                        className="text-xs bg-[#0f6b53] text-white rounded-lg px-3 py-1.5 font-semibold hover:opacity-90"
                      >
                        Fabriquer la story
                      </Link>
                    ) : i.gabarit === "semaine" ? (
                      <Link
                        href="/semaine"
                        className="text-xs bg-[#0f6b53] text-white rounded-lg px-3 py-1.5 font-semibold hover:opacity-90"
                      >
                        Ouvrir la story de la semaine
                      </Link>
                    ) : (
                      <Link
                        href="/studio"
                        className="text-xs border border-[#0f6b53] text-[#0f6b53] rounded-lg px-3 py-1.5 font-semibold hover:bg-[#e5f2ee]"
                      >
                        Écrire dans le studio
                      </Link>
                    )}

                    <form action={changerStatutItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="decalage" value={decalage} />
                      <input type="hidden" name="statut" value={i.statut === "garde" ? "prevu" : "garde"} />
                      <button className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:border-[#0f6b53] hover:text-[#0f6b53]">
                        {i.statut === "garde" ? "Ne plus garder" : "Garder"}
                      </button>
                    </form>

                    <form action={supprimerItem} className="ml-auto">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="decalage" value={decalage} />
                      <button className="text-xs text-gray-400 hover:text-red-600 px-2 py-1.5">Écarter</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          Refaire le mois efface les contenus encore à l&apos;état de projet, mais jamais ce qui est déjà programmé ou
          publié.
        </p>
      </div>
    </main>
  );
}
