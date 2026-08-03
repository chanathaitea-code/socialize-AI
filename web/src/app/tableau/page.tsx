import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { JOURS, MOIS, iso } from "@/lib/semaine";
import { premierDuMois } from "@/lib/rapport";
import { meteoDuJour } from "@/lib/meteo";
import Nav from "../nav";
import { annulerEnvoi } from "../journal/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function aujourdhuiParis(): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
}

const ORIGINES: Record<string, string> = {
  hebdo: "Story de la semaine",
  gabarit: "Story fabriquée à la main",
  studio: "Proposition du studio",
  "auto-rebours": "Compte à rebours avant service",
  "auto-plat": "Plat à l’honneur",
  "auto-envie": "Jour sans service",
  "auto-calendrier": "Contenu du calendrier",
};

/** « part dans 2 h », « part dans 25 min », « en retard » */
function quand(iso8601: string): string {
  const minutes = Math.round((new Date(iso8601).getTime() - Date.now()) / 60_000);
  if (minutes < 0) return "part d’un instant à l’autre";
  if (minutes < 60) return `part dans ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `part dans ${heures} h`;
  return `part dans ${Math.round(heures / 24)} j`;
}

const heureParis = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit" });

export default async function TableauPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;

  const jour = aujourdhuiParis();
  const mois = premierDuMois(0);
  const finMois = new Date(mois);
  finMois.setUTCMonth(finMois.getUTCMonth() + 1);
  const lundi = new Date(jour);
  lundi.setUTCDate(lundi.getUTCDate() - ((lundi.getUTCDay() + 6) % 7));
  const dimanche = new Date(lundi);
  dimanche.setUTCDate(dimanche.getUTCDate() + 6);

  const [
    { data: slots },
    { data: jobs },
    { data: partis },
    { data: prevus },
    { data: semaine },
    { data: comptes },
    { data: photo },
    { data: reglages },
    { data: auto },
  ] = await Promise.all([
    supabase.from("location_schedule").select("id, service, time_range, note, status").eq("day", iso(jour)).order("service"),
    supabase
      .from("story_jobs")
      .select("id, run_at, origin, format, targets, caption, media_path")
      .eq("status", "scheduled")
      .order("run_at")
      .limit(6),
    supabase
      .from("publication_log")
      .select("id", { count: "exact", head: false })
      .eq("status", "published")
      .gte("created_at", mois.toISOString())
      .lt("created_at", finMois.toISOString()),
    supabase
      .from("editorial_items")
      .select("id, jour, rubrique, alertes, statut")
      .eq("mois", iso(mois))
      .in("statut", ["prevu", "garde"]),
    supabase.from("location_schedule").select("id, status").gte("day", iso(lundi)).lte("day", iso(dimanche)),
    supabase.from("social_accounts").select("platform, status"),
    supabase.from("media_assets").select("created_at").eq("kind", "photo").order("created_at", { ascending: false }).limit(1),
    supabase.from("automation_settings").select("mode").limit(1),
    supabase.from("story_auto").select("*").limit(1),
  ]);

  const services = (slots ?? []).filter((s) => s.status !== "cancelled");
  const regles = (auto?.[0] ?? {}) as Record<string, unknown>;
  const enPause = reglages?.[0]?.mode === "paused";

  // La météo du premier service, celle qui décide de la journée
  const meteo =
    brandId && services[0]
      ? await meteoDuJour(supabase, brandId, services[0].note ?? "", services[0].service === "midi" ? 12 : 19)
      : null;

  const titreJour = `${JOURS[(jour.getUTCDay() + 6) % 7]} ${jour.getUTCDate()} ${MOIS[jour.getUTCMonth()]}`;

  const matinee = services.length
    ? `Aujourd’hui, le camion est ${services
        .map((s) => `${s.service === "soir" ? "le soir" : "à midi"} à ${s.note ?? "un emplacement sans nom"}`)
        .join(" et ")}.`
    : "Le camion ne sort pas aujourd’hui.";
  const suite = jobs?.length
    ? ` ${jobs.length} envoi${jobs.length > 1 ? "s sont programmés" : " est programmé"}, annulable${
        jobs.length > 1 ? "s" : ""
      } jusqu’au départ.`
    : " Aucun envoi n’est programmé pour l’instant.";
  const conseil = meteo?.conseil ? ` ${meteo.conseil}` : "";

  const nbAlertes = (prevus ?? []).filter((p) => ((p.alertes ?? []) as string[]).length > 0).length;
  const casses = (comptes ?? []).filter((c) => c.status !== "connected");
  const ageP = photo?.[0]?.created_at
    ? Math.floor((Date.now() - new Date(photo[0].created_at as string).getTime()) / 86_400_000)
    : null;
  const reglesActives = ["ligne_auto", "rebours_enabled", "plat_enabled", "envie_enabled", "calendrier_auto"].filter(
    (c) => regles[c]
  ).length;

  const compteurs = [
    { v: (partis ?? []).length, l: "publiées ce mois-ci", s: MOIS[mois.getUTCMonth()] },
    { v: (jobs ?? []).length, l: "envois programmés", s: "annulables avant départ" },
    { v: (prevus ?? []).length, l: "contenus au calendrier", s: "prévus ce mois-ci" },
    {
      v: (semaine ?? []).filter((s) => s.status !== "cancelled").length,
      l: "services cette semaine",
      s: `du ${lundi.getUTCDate()} au ${dimanche.getUTCDate()}`,
    },
  ];

  return (
    <main>
      <Nav actif="/tableau" />

      <div className="px-6 py-6 grid gap-5 max-w-[1200px]">
        {/* La matinée, comme dans la maquette : ce qu'il faut savoir en dix secondes */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-[#12211c]">
            ☀ Votre journée, préparée par SocialFlow{" "}
            <span className="font-normal text-gray-400">· {titreJour}</span>
          </div>
          <p className="text-sm text-[#12211c] mt-2 leading-relaxed max-w-3xl">
            {matinee}
            {meteo?.temperature !== undefined && ` ${meteo.temperature} °C et ${meteo.resume} sur place.`}
            {suite}
            {conseil}
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Link
              href="/jour"
              className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Voir la journée
            </Link>
            <Link
              href="/calendrier"
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:border-[#0f6b53] hover:text-[#0f6b53]"
            >
              Ouvrir le calendrier
            </Link>
            <Link
              href="/emplacements"
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:border-red-400 hover:text-red-600"
            >
              Journée annulée
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {compteurs.map((c) => (
            <div key={c.l} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] text-gray-400">{c.l}</div>
              <div className="text-3xl font-extrabold text-[#12211c] tabular-nums mt-1">{c.v}</div>
              <div className="text-[11px] text-gray-400 mt-1">{c.s}</div>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-[1.35fr_1fr] gap-5 items-start">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="font-bold text-[#12211c]">Prochaines publications</div>
            {!jobs?.length ? (
              <p className="text-sm text-gray-400 mt-3">
                Rien de programmé. Le pilote automatique remplit cette liste tout seul quand il est activé, et vous
                pouvez toujours programmer à la main depuis Stories ou le Studio.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-gray-100">
                {jobs.map((j) => (
                  <div key={j.id as string} className="py-3 flex items-start gap-3 flex-wrap">
                    {j.media_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={supabase.storage.from("media").getPublicUrl(j.media_path as string).data.publicUrl}
                        alt=""
                        className="w-10 h-14 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-[#e5f2ee]" />
                    )}
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-sm font-semibold text-[#12211c]">
                        {ORIGINES[String(j.origin)] ?? "Publication"}
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-2">{String(j.caption ?? "").slice(0, 110)}</div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-[#fdeaf3] text-[#a3266b]">
                          {String(j.format ?? "story")}
                        </span>
                        {((j.targets ?? []) as string[]).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-gray-100 text-gray-500"
                          >
                            {t === "instagram" ? "IG" : "FB"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-[#0f6b53]">{quand(String(j.run_at))}</div>
                      <div className="text-[11px] text-gray-400">{heureParis(String(j.run_at))}</div>
                      <form action={annulerEnvoi}>
                        <input type="hidden" name="id" value={j.id as string} />
                        <button className="text-[11px] text-gray-400 hover:text-red-600 underline">Annuler</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="font-bold text-[#12211c]">Alertes et suggestions</div>
            <div className="grid gap-3 mt-3">
              <Alerte
                couleur={casses.length ? "rouge" : "vert"}
                titre={
                  casses.length
                    ? `${casses.map((c) => c.platform).join(" et ")} ne répond plus`
                    : `Comptes connectés : ${(comptes ?? []).length}/${(comptes ?? []).length || 0}`
                }
                detail={
                  casses.length
                    ? "Reconnectez depuis Mes réseaux, sinon les publications échoueront."
                    : "Vérifié automatiquement toutes les cinq minutes."
                }
              />
              {enPause && (
                <Alerte
                  couleur="orange"
                  titre="Tout est en pause"
                  detail="Aucune publication ne partira tant que vous n’aurez pas relancé depuis le Journal."
                />
              )}
              <Alerte
                couleur={reglesActives ? "vert" : "gris"}
                titre={
                  reglesActives
                    ? `Pilote automatique : ${reglesActives} règle${reglesActives > 1 ? "s" : ""} active${reglesActives > 1 ? "s" : ""}`
                    : "Pilote automatique éteint"
                }
                detail={
                  reglesActives
                    ? `Les envois restent annulables ${String(regles.auto_grace ?? 30)} minutes.`
                    : "Cinq règles peuvent publier à votre place, à activer dans le Journal."
                }
              />
              <Alerte
                couleur={ageP === null ? "orange" : ageP > 10 ? "orange" : "vert"}
                titre={
                  ageP === null
                    ? "Aucune photo dans la bibliothèque"
                    : ageP <= 1
                      ? "Photos fraîches"
                      : `Dernière photo il y a ${ageP} jours`
                }
                detail={
                  ageP === null || ageP > 10
                    ? "Les stories automatiques prennent la dernière photo : gardez-en une bonne et récente."
                    : "C’est celle qu’utilisent les stories automatiques."
                }
              />
              {nbAlertes > 0 && (
                <Alerte
                  couleur="orange"
                  titre={`${nbAlertes} contenu${nbAlertes > 1 ? "s" : ""} à vérifier au calendrier`}
                  detail="Un prix ou un mot signalé : à relire avant que ça parte."
                />
              )}
              <Alerte
                couleur="gris"
                titre={`Rapport de ${MOIS[(mois.getUTCMonth() + 11) % 12]}`}
                detail="Le rapport du mois écoulé s’établit tout seul le 1er à 9h."
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Alerte({ couleur, titre, detail }: { couleur: string; titre: string; detail: string }) {
  const pastille: Record<string, string> = {
    vert: "bg-[#0f6b53]",
    orange: "bg-amber-500",
    rouge: "bg-red-500",
    gris: "bg-gray-300",
  };
  return (
    <div className="flex gap-2.5">
      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${pastille[couleur] ?? pastille.gris}`} />
      <div>
        <div className="text-sm font-semibold text-[#12211c] leading-snug">{titre}</div>
        <div className="text-xs text-gray-400 leading-snug mt-0.5">{detail}</div>
      </div>
    </div>
  );
}
