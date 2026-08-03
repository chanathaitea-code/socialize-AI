import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Nav from "../nav";
import { annulerEnvoi, basculerHebdo, basculerPause, basculerRegle, reglerPilote, supprimerPublication } from "./actions";

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

  const { data: autoData } = await supabase.from("story_auto").select("*").limit(1);
  const reglagesAuto = (autoData?.[0] ?? {}) as Record<string, unknown>;
  const hebdoActif = Boolean(reglagesAuto.enabled ?? false);

  // Le pilote automatique : chaque règle prépare un envoi, jamais une publication directe
  const REGLES = [
    {
      champ: "ligne_auto",
      titre: "Ligne éditoriale du mois",
      quoi: "Le 1er de chaque mois à 8h, le calendrier du mois s'établit tout seul à partir de vos emplacements et de la saison. Rien n'est publié : c'est du travail préparé.",
    },
    {
      champ: "rebours_enabled",
      titre: "Compte à rebours avant chaque service",
      quoi: "Une story « on ouvre dans 1h » part une heure avant chaque service, avec le lieu et l'horaire du jour. C'est le moment où les gens choisissent où déjeuner.",
    },
    {
      champ: "plat_enabled",
      titre: "Plat à l'honneur, mardi et vendredi",
      quoi: "Deux fois par semaine à 11h, une story sur un plat de votre carte, avec son prix et votre dernière photo. Les plats tournent, sans se répéter.",
    },
    {
      champ: "envie_enabled",
      titre: "Les jours sans service",
      quoi: "À midi, les jours où le camion ne sort pas, une story qui donne envie et qui donne rendez-vous au prochain service. Ne jamais disparaître des fils.",
    },
    {
      champ: "calendrier_auto",
      titre: "Les contenus du calendrier",
      quoi: "La veille au soir, chaque contenu prévu au calendrier pour le lendemain est fabriqué et mis en attente pour 11h30.",
    },
  ] as const;

  const { data: reglages } = await supabase.from("automation_settings").select("mode").limit(1);
  const enPause = reglages?.[0]?.mode === "paused";

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
          action={basculerPause}
          className={`mt-6 rounded-xl border p-5 flex items-center gap-4 flex-wrap ${
            enPause ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
          }`}
        >
          <input type="hidden" name="enPause" value={String(enPause)} />
          <div className="flex-1 min-w-[240px]">
            <div className="font-bold text-[#12211c]">Pause générale</div>
            <div className="text-sm text-gray-500">
              Le coupe-circuit : rien ne part, ni les envois programmés, ni la story du dimanche. Les envois restent en
              attente et repartiront quand vous relancerez.
            </div>
          </div>
          <span
            className={`text-[11px] font-bold uppercase rounded-full px-3 py-1 ${
              enPause ? "bg-amber-200 text-amber-900" : "bg-gray-100 text-gray-500"
            }`}
          >
            {enPause ? "en pause" : "actif"}
          </span>
          <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
            {enPause ? "Tout relancer" : "Tout mettre en pause"}
          </button>
        </form>

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

        <section className="mt-6 rounded-xl border border-[#c8e2da] bg-white p-5">
          <div className="font-bold text-[#12211c]">Pilote automatique</div>
          <p className="text-sm text-gray-500 mt-1">
            Ce que l&apos;application fait sans rien vous demander. Chaque règle prépare un envoi et le laisse en
            attente : vous avez {String(reglagesAuto.auto_grace ?? 30)} minutes pour le couper ici avant qu&apos;il ne
            parte.
          </p>

          <div className="grid gap-2 mt-4">
            {REGLES.map((regle) => {
              const actif = Boolean(reglagesAuto[regle.champ] ?? false);
              return (
                <form
                  key={regle.champ}
                  action={basculerRegle}
                  className={`rounded-lg border p-4 flex items-start gap-3 flex-wrap ${
                    actif ? "border-[#0f6b53] bg-[#f5faf8]" : "border-gray-200"
                  }`}
                >
                  <input type="hidden" name="champ" value={regle.champ} />
                  <input type="hidden" name="actif" value={String(actif)} />
                  <div className="flex-1 min-w-[240px]">
                    <div className="text-sm font-semibold text-[#12211c]">{regle.titre}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">{regle.quoi}</div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase rounded-full px-3 py-1 ${
                      actif ? "bg-[#e5f2ee] text-[#0f6b53]" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {actif ? "active" : "coupée"}
                  </span>
                  <button className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
                    {actif ? "Couper" : "Activer"}
                  </button>
                </form>
              );
            })}
          </div>

          <form action={reglerPilote} className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap text-sm">
            <label className="flex items-center gap-2">
              Délai d&apos;annulation
              <input
                type="number"
                name="delai"
                min={5}
                max={120}
                defaultValue={String(reglagesAuto.auto_grace ?? 30)}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1.5"
              />
              minutes
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="instagram"
                defaultChecked={((reglagesAuto.auto_targets as string[]) ?? ["instagram"]).includes("instagram")}
                className="w-4 h-4 accent-[#0f6b53]"
              />
              Instagram
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="facebook"
                defaultChecked={((reglagesAuto.auto_targets as string[]) ?? []).includes("facebook")}
                className="w-4 h-4 accent-[#0f6b53]"
              />
              Facebook
            </label>
            <button className="border border-gray-300 rounded-lg px-3 py-1.5 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
              Enregistrer
            </button>
          </form>
        </section>

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
