import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Nav from "../nav";
import { annulerEnvoi, basculerHebdo, supprimerPublication } from "./actions";

export const dynamic = "force-dynamic";

type Job = {
  id: string;
  run_at: string;
  monday: string;
  origin: string;
  status: string;
  targets: string[] | null;
  error: string | null;
  kind: string | null;
  format: string | null;
  caption: string | null;
  media_path: string | null;
};

type Ligne = {
  id: string;
  platform: string;
  status: string;
  caption: string | null;
  media_url: string | null;
  error: string | null;
  created_at: string;
  remote_id: string | null;
};

const RESEAU: Record<string, string> = { instagram: "Story Instagram", facebook: "Page Facebook" };

function quand(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { err, ok } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobsData } = await supabase
    .from("story_jobs")
    .select("id, run_at, monday, origin, status, targets, error, kind, format, caption, media_path")
    .eq("status", "scheduled")
    .order("run_at");
  const jobs = (jobsData ?? []) as Job[];

  const { data: logData } = await supabase
    .from("publication_log")
    .select("id, platform, status, caption, media_url, error, created_at, remote_id")
    .order("created_at", { ascending: false })
    .limit(30);
  const lignes = (logData ?? []) as Ligne[];

  const { data: autoData } = await supabase.from("story_auto").select("enabled").limit(1);
  const hebdoActif = autoData?.[0]?.enabled ?? false;

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/journal" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[#12211c]">Journal des publications</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Tout ce qui est parti, tout ce qui va partir. Un envoi programmé reste annulable jusqu&apos;à la dernière
          minute, et une publication Facebook peut être retirée d&apos;ici.
        </p>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        <form
          action={basculerHebdo}
          className="mt-6 rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4 flex-wrap"
        >
          <input type="hidden" name="actif" value={String(hebdoActif)} />
          <div className="flex-1 min-w-[240px]">
            <div className="font-bold text-[#12211c]">Story automatique du dimanche</div>
            <div className="text-sm text-gray-500">
              Chaque dimanche à 18h, la story de la semaine suivante est préparée avec votre dernière photo, puis
              envoyée un quart d&apos;heure plus tard. Vous recevez donc quinze minutes pour l&apos;annuler ici.
            </div>
          </div>
          <span
            className={`text-[11px] font-bold uppercase rounded-full px-3 py-1 ${
              hebdoActif ? "bg-[#e5f2ee] text-[#0f6b53]" : "bg-gray-100 text-gray-500"
            }`}
          >
            {hebdoActif ? "activée" : "coupée"}
          </span>
          <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
            {hebdoActif ? "Couper" : "Activer"}
          </button>
        </form>

        {jobs.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Envois à venir</div>
            <div className="grid gap-2">
              {jobs.map((j) => (
                <div key={j.id} className="bg-white border border-amber-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
                  {j.media_path && j.kind === "photo" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={supabase.storage.from("media").getPublicUrl(j.media_path).data.publicUrl}
                      alt=""
                      className="w-11 h-11 object-cover rounded-lg border border-amber-200"
                    />
                  )}
                  <span className="text-[10px] font-bold uppercase rounded px-2 py-1 bg-amber-100 text-amber-800">
                    {j.origin === "hebdo" ? "automatique" : "programmé"}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-semibold text-[#12211c]">Départ {quand(j.run_at)}</div>
                    <div className="text-gray-500">
                      {j.kind === "photo"
                        ? `${j.format === "story" ? "Story" : "Publication"} du studio`
                        : "Story des emplacements"}{" "}
                      · {(j.targets ?? []).map((t) => RESEAU[t] ?? t).join(" et ")}
                    </div>
                    {j.caption && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{j.caption}</div>}
                  </div>
                  <form action={annulerEnvoi}>
                    <input type="hidden" name="id" value={j.id} />
                    <button className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-red-400 hover:text-red-600">
                      Annuler
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Historique</div>
          {lignes.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
              Rien n&apos;est encore parti depuis l&apos;application.
            </p>
          ) : (
            <div className="grid gap-2">
              {lignes.map((l) => (
                <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
                  {l.media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.media_url} alt="" className="w-12 h-20 object-cover rounded-lg border border-gray-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#12211c]">{RESEAU[l.platform] ?? l.platform}</span>
                      <span
                        className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${
                          l.status === "published"
                            ? "bg-[#e5f2ee] text-[#0f6b53]"
                            : l.status === "cancelled"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {l.status === "published" ? "publié" : l.status === "cancelled" ? "retiré" : "échec"}
                      </span>
                      <span className="text-xs text-gray-400">{quand(l.created_at)}</span>
                    </div>
                    {l.caption && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{l.caption}</p>}
                    {l.error && <p className="text-xs text-red-700 mt-1">{l.error}</p>}
                  </div>
                  {l.status === "published" && l.platform === "facebook" && (
                    <form action={supprimerPublication}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 rounded-lg px-2 py-1">
                        Retirer
                      </button>
                    </form>
                  )}
                  {l.status === "published" && l.platform === "instagram" && (
                    <span
                      className="text-[11px] text-gray-400 max-w-[120px] leading-tight"
                      title="Meta ne permet pas de supprimer un contenu Instagram publié par une application"
                    >
                      retrait impossible à distance, passez par Instagram
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Une story Instagram ne peut pas être supprimée à distance : Meta ne le permet pas. Passez par l&apos;application
          Instagram, elle disparaît de toute façon au bout de vingt-quatre heures.
        </p>
      </div>
    </main>
  );
}
