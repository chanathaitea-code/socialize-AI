import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import Nav from "../nav";
import { changerStatut, genererSemaine, supprimerIdee } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Idee = {
  id: string;
  jour: string | null;
  format: string;
  angle: string | null;
  accroche: string | null;
  texte: string | null;
  hashtags: string | null;
  conseil: string | null;
  alertes: string[] | null;
  statut: string;
};

const FORMAT: Record<string, { nom: string; fond: string; texte: string }> = {
  post: { nom: "Post", fond: "#e5f2ee", texte: "#0f6b53" },
  story: { nom: "Story", fond: "#fdeaf3", texte: "#a3266b" },
  reel: { nom: "Reel", fond: "#eae6fd", texte: "#4b2fa8" },
  avis: { nom: "Avis", fond: "#fff3d6", texte: "#8a5a00" },
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; w?: string }>;
}) {
  const { err, ok, w: wRaw } = await searchParams;
  const w = clampWeek(wRaw);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monday = mondayOf(w);
  const { data } = await supabase
    .from("content_ideas")
    .select("id, jour, format, angle, accroche, texte, hashtags, conseil, alertes, statut")
    .eq("monday", iso(monday))
    .neq("statut", "rejete")
    .order("created_at", { ascending: false });
  const idees = (data ?? []) as Idee[];

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/studio" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h2 className="text-xl font-bold text-[#12211c]">Studio de contenu</h2>
            <p className="text-sm text-gray-500 mt-1">
              Des propositions écrites à partir de votre profil de marque, de votre carte et de vos emplacements réels.
              Rien n&apos;est publié d&apos;ici : vous gardez, vous jetez, vous copiez.
            </p>
          </div>
          <form action={genererSemaine}>
            <input type="hidden" name="w" value={w} />
            <button className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
              Proposer 6 contenus
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 mt-4 text-sm">
          <Link
            href="/studio"
            className={`rounded-lg px-3 py-1.5 border ${w === 0 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}
          >
            Cette semaine
          </Link>
          <Link
            href="/studio?w=1"
            className={`rounded-lg px-3 py-1.5 border ${w === 1 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}
          >
            Semaine prochaine
          </Link>
          <span className="text-gray-400">{libellePeriode(monday)}</span>
        </div>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        <div className="mt-6 grid gap-3">
          {idees.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
              Aucune proposition pour cette semaine. Le bouton en haut à droite en écrit six d&apos;un coup, à partir de ce
              que vous avez renseigné dans Ma marque et Emplacements.
            </p>
          ) : (
            idees.map((i) => {
              const f = FORMAT[i.format] ?? FORMAT.post;
              return (
                <div
                  key={i.id}
                  className={`bg-white border rounded-xl p-5 ${i.statut === "garde" ? "border-[#0f6b53]" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold uppercase rounded px-2 py-1"
                      style={{ background: f.fond, color: f.texte }}
                    >
                      {f.nom}
                    </span>
                    {i.jour && <span className="text-xs font-semibold text-[#12211c]">{i.jour}</span>}
                    {i.angle && <span className="text-xs text-gray-400">{i.angle}</span>}
                    {i.statut === "garde" && (
                      <span className="text-[10px] font-bold uppercase rounded px-2 py-1 bg-[#e5f2ee] text-[#0f6b53]">
                        gardé
                      </span>
                    )}
                  </div>

                  {i.accroche && <div className="font-bold text-[#12211c] mt-3">{i.accroche}</div>}
                  {i.texte && <p className="text-sm text-[#12211c] mt-1 whitespace-pre-line leading-relaxed">{i.texte}</p>}
                  {i.hashtags && <p className="text-xs text-gray-400 mt-2">{i.hashtags}</p>}
                  {i.conseil && (
                    <p className="text-xs text-gray-500 mt-3 border-l-2 border-gray-200 pl-3">📸 {i.conseil}</p>
                  )}

                  {(i.alertes ?? []).length > 0 && (
                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      {(i.alertes ?? []).map((a, n) => (
                        <p key={n} className="text-xs text-amber-800">
                          ⚠ {a}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    <form action={changerStatut}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="statut" value={i.statut === "garde" ? "propose" : "garde"} />
                      <button className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:border-[#0f6b53] hover:text-[#0f6b53]">
                        {i.statut === "garde" ? "Ne plus garder" : "Garder"}
                      </button>
                    </form>
                    <form action={supprimerIdee} className="ml-auto">
                      <input type="hidden" name="id" value={i.id} />
                      <button className="text-xs text-gray-400 hover:text-red-600 px-2 py-1.5">Supprimer</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Les prix cités sont vérifiés contre votre carte, et les mots que vous avez interdits dans Ma marque sont
          signalés. Une proposition avec un avertissement orange ne doit pas partir telle quelle.
        </p>
      </div>
    </main>
  );
}
