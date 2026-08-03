import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { premierDuMois, type Rapport } from "@/lib/rapport";
import { MOIS } from "@/lib/semaine";
import Nav from "../nav";
import { genererRapport } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESEAU: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };

export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; m?: string }>;
}) {
  const { err, ok, m } = await searchParams;
  const decalage = Math.max(-12, Math.min(0, parseInt(m ?? "-1", 10) || -1));
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mois = premierDuMois(decalage);
  const cle = mois.toISOString().slice(0, 10);
  const { data } = await supabase.from("monthly_reports").select("contenu").eq("mois", cle).maybeSingle();
  const r = (data?.contenu ?? null) as Rapport | null;
  const intitule = `${MOIS[mois.getUTCMonth()]} ${mois.getUTCFullYear()}`;

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/rapport" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-xl font-bold text-[#12211c] capitalize">Rapport de {intitule}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ce qui est parti, ce que ça a donné, ce qu&apos;il faut changer. Les chiffres sont figés ici, parce que
              Meta les efface avec le temps.
            </p>
          </div>
          <form action={genererRapport}>
            <input type="hidden" name="decalage" value={decalage} />
            <button className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
              {r ? "Refaire le rapport" : "Établir le rapport"}
            </button>
          </form>
        </div>

        <div className="flex gap-2 mt-4 text-sm flex-wrap">
          {[-1, -2, -3, 0].map((d) => {
            const mo = premierDuMois(d);
            return (
              <Link
                key={d}
                href={`/rapport?m=${d}`}
                className={`rounded-lg px-3 py-1.5 border capitalize ${
                  d === decalage ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"
                }`}
              >
                {d === 0 ? "mois en cours" : `${MOIS[mo.getUTCMonth()]}`}
              </Link>
            );
          })}
        </div>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        {!r ? (
          <p className="mt-6 text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
            Aucun rapport pour ce mois. Le bouton en haut à droite l&apos;établit à partir de vos publications, de vos
            statistiques et de vos services.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { v: r.publications, l: "publications" },
                { v: r.services, l: "services assurés" },
                { v: r.vuesPage ?? 0, l: "vues de la Page" },
                { v: r.nouveauxAbonnes ?? 0, l: "nouveaux abonnés" },
              ].map((c) => (
                <div key={c.l} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-2xl font-extrabold text-[#0f6b53] tabular-nums">{c.v}</div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">{c.l}</div>
                </div>
              ))}
            </div>

            {r.lecture && (
              <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Ce que ça dit</div>
                <p className="text-sm text-[#12211c] leading-relaxed whitespace-pre-line">{r.lecture}</p>
              </div>
            )}

            {(r.recommandations ?? []).length > 0 && (
              <div className="mt-4 bg-white border border-[#c8e2da] rounded-xl p-5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#0f6b53] mb-3">
                  À faire le mois prochain
                </div>
                <div className="grid gap-3">
                  {(r.recommandations ?? []).map((rec, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#0f6b53] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-[#12211c] leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Détail</div>
              <p>
                Réparti en{" "}
                {Object.entries(r.parReseau ?? {})
                  .map(([k, v]) => `${v} sur ${RESEAU[k] ?? k}`)
                  .join(" et ") || "aucune publication"}
                {r.echecs > 0 ? `, avec ${r.echecs} envoi${r.echecs > 1 ? "s" : ""} en échec` : ", sans aucun échec"}.
                {typeof r.interactions === "number" ? ` ${r.interactions} interactions sur la Page.` : ""}
              </p>
              {r.meilleure && (
                <p className="mt-3">
                  La publication la plus suivie était sur {RESEAU[r.meilleure.reseau] ?? r.meilleure.reseau} :
                  <span className="italic"> « {r.meilleure.legende}… »</span>
                </p>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-gray-400 mt-6">
          Le rapport du mois écoulé s&apos;établit tout seul le 1er de chaque mois. Vous pouvez le refaire à tout moment,
          il sera simplement remplacé.
        </p>
      </div>
    </main>
  );
}
