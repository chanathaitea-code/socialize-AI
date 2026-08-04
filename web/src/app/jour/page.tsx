import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { JOURS, MOIS, iso } from "@/lib/semaine";
import { meteoDuJour, type Meteo } from "@/lib/meteo";
import Nav from "../nav";
import { basculerJourAuto, basculerRupture, publierStoryDuJour } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Date à N jours, isolée du rendu (le linter interdit Date.now() en rendu). */
function dansNJours(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

function aujourdhuiParis(): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
}

export default async function JourPage({
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

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;

  const jour = aujourdhuiParis();
  const indice = (jour.getUTCDay() + 6) % 7;
  const titre = `${JOURS[indice]} ${jour.getUTCDate()} ${MOIS[jour.getUTCMonth()]}`;

  const { data: slots } = await supabase
    .from("location_schedule")
    .select("id, service, time_range, note, status")
    .eq("day", iso(jour))
    .order("service");
  const services = (slots ?? []).filter((s) => s.status !== "cancelled");
  const annulee = (slots ?? []).length > 0 && services.length === 0;

  // Météo à l'heure du service, sur le lieu du service
  const meteos: Meteo[] = brandId
    ? await Promise.all(
        services.map((s) => meteoDuJour(supabase, brandId, s.note ?? "", s.service === "midi" ? 12 : 19))
      )
    : [];

  // Rien aujourd'hui ? Alors on annonce le prochain rendez-vous, avec sa météo
  let prochain: { jour: string; service: string; note: string | null; time_range: string | null } | null = null;
  let meteoProchain: Meteo | null = null;
  if (services.length === 0) {
    const { data: suite } = await supabase
      .from("location_schedule")
      .select("day, service, note, time_range, status")
      .gt("day", iso(jour))
      .neq("status", "cancelled")
      .order("day")
      .order("service")
      .limit(1);
    const p = suite?.[0];
    if (p) {
      prochain = { jour: p.day, service: p.service, note: p.note, time_range: p.time_range };
      const dansTroisJours = (new Date(p.day + "T00:00:00Z").getTime() - jour.getTime()) / 86_400_000 <= 3;
      if (brandId && dansTroisJours) {
        meteoProchain = await meteoDuJour(supabase, brandId, p.note ?? "", p.service === "midi" ? 12 : 19, p.day);
      }
    }
  }

  const { data: produits } = await supabase
    .from("products")
    .select("id, name, out_of_stock")
    .order("name")
    .limit(30);
  const ruptures = (produits ?? []).filter((p) => p.out_of_stock);

  const { data: medias } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("kind", "photo")
    .order("created_at", { ascending: false })
    .limit(8);
  const photos = (medias ?? []).map((m) => ({
    chemin: m.storage_path as string,
    url: supabase.storage.from("media").getPublicUrl(m.storage_path as string).data.publicUrl,
  }));

  // Échéances de prospection : remontées ici parce qu'une date limite ratée
  // coûte une année entière. Requête vide (donc carte masquée) pour qui n'a pas
  // le module — les policies filtrent la table opportunities.
  const horizonEcheances = dansNJours(15);
  const { data: echeances } = await supabase
    .from("opportunities")
    .select("id, name, city, application_deadline")
    .not("application_deadline", "is", null)
    .gte("application_deadline", iso(jour))
    .lte("application_deadline", horizonEcheances)
    .not("status", "in", "(won,lost)")
    .order("application_deadline", { ascending: true })
    .limit(5);

  const { data: reglages } = await supabase
    .from("story_auto")
    .select("jour_enabled, jour_hour_paris")
    .limit(1);
  const jourAuto = reglages?.[0]?.jour_enabled ?? false;
  const heureAuto = reglages?.[0]?.jour_hour_paris ?? 9;

  const { data: comptes } = await supabase.from("social_accounts").select("platform, status");
  const igPret = (comptes ?? []).some((c) => c.platform === "instagram" && c.status === "connected");
  const fbPret = (comptes ?? []).some((c) => c.platform === "facebook" && c.status === "connected");
  const resumeMeteo = meteos.find((m) => m.resume)
    ? `${meteos[0].temperature}°, ${meteos[0].resume}`
    : "";

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/jour" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-extrabold text-[#12211c] capitalize">{titre}</h2>
        <p className="text-sm text-gray-500 mt-1">
          Tout ce qu&apos;il faut savoir ce matin, et la story du jour prête à partir.
        </p>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        {(echeances ?? []).length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-bold text-[#12211c]">Échéances de prospection</div>
              <Link href="/veille" className="text-xs font-semibold text-[#0f6b53] underline">
                Voir la veille
              </Link>
            </div>
            <p className="text-sm text-amber-900/80 mt-1">
              Une date limite ratée coûte une année entière.
            </p>
            <ul className="mt-3 divide-y divide-amber-200/70">
              {(echeances ?? []).map((o) => {
                const j = Math.round(
                  (new Date((o.application_deadline as string) + "T00:00:00Z").getTime() -
                    jour.getTime()) /
                    86_400_000,
                );
                return (
                  <li key={o.id} className="py-2">
                    <Link href={`/opportunites/${o.id}`} className="flex items-center gap-3">
                      <span
                        className={`w-14 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold ${
                          j <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        J-{j}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-[#12211c] truncate">
                        {o.name}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{o.city}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {annulee ? (
            <div className="bg-white border border-red-200 rounded-xl p-5">
              <div className="font-bold text-[#12211c]">Journée annulée</div>
              <p className="text-sm text-gray-500 mt-1">
                Vous avez annulé les services d&apos;aujourd&apos;hui. Rien ne sera annoncé.
              </p>
            </div>
          ) : services.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="font-bold text-[#12211c]">Pas de service aujourd&apos;hui</div>
              <p className="text-sm text-gray-500 mt-1">
                Le camion se repose.{" "}
                <Link href="/emplacements" className="underline">
                  Ajouter un emplacement
                </Link>{" "}
                si c&apos;est un oubli.
              </p>
              {prochain && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                  <div className="min-w-[200px] flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Prochain rendez-vous
                    </div>
                    <div className="font-bold text-[#12211c] mt-1">
                      {new Intl.DateTimeFormat("fr-FR", {
                        timeZone: "Europe/Paris",
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).format(new Date(prochain.jour + "T12:00:00Z"))}{" "}
                      · {prochain.service}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prochain.note} · {prochain.time_range}
                    </div>
                  </div>
                  {meteoProchain?.erreur && (
                    <span className="text-xs text-gray-400">météo : {meteoProchain.erreur}</span>
                  )}
                  {meteoProchain && !meteoProchain.erreur && (
                    <div className="text-right">
                      <div className="text-2xl font-extrabold text-[#0f6b53] tabular-nums">
                        {meteoProchain.temperature}°
                      </div>
                      <div className="text-xs text-gray-500">
                        {meteoProchain.resume}
                        {typeof meteoProchain.pluie === "number" ? ` · ${meteoProchain.pluie} % de pluie` : ""}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            services.map((s, i) => {
              const m = meteos[i];
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4 items-start flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase rounded px-2 py-1 ${
                      s.service === "midi" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {s.service}
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <div className="font-bold text-[#12211c]">{s.note}</div>
                    <div className="text-sm text-gray-500">{s.time_range}</div>
                  </div>
                  <div className="text-right">
                    {m?.erreur ? (
                      <span className="text-xs text-gray-400">météo indisponible</span>
                    ) : (
                      <>
                        <div className="text-2xl font-extrabold text-[#0f6b53] tabular-nums">{m?.temperature}°</div>
                        <div className="text-xs text-gray-500">
                          {m?.resume}
                          {typeof m?.pluie === "number" ? ` · ${m.pluie} % de pluie` : ""}
                        </div>
                      </>
                    )}
                  </div>
                  {m?.conseil && <p className="w-full text-sm text-[#0f6b53] bg-[#f7fbf9] rounded-lg px-3 py-2">{m.conseil}</p>}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="font-bold text-[#12211c]">Ruptures du jour</div>
          <p className="text-sm text-gray-500 mt-1">
            Ce qui est signalé ici disparaît des contenus proposés par le studio.
          </p>
          {ruptures.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {ruptures.map((p) => (
                <form key={p.id} action={basculerRupture}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="rupture" value="true" />
                  <button className="text-xs rounded-lg px-3 py-1.5 bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200">
                    {p.name} · remettre en vente
                  </button>
                </form>
              ))}
            </div>
          )}
          <details className="mt-3">
            <summary className="text-xs font-semibold text-[#0f6b53] cursor-pointer">Signaler une rupture</summary>
            <div className="flex gap-2 flex-wrap mt-3">
              {(produits ?? [])
                .filter((p) => !p.out_of_stock)
                .map((p) => (
                  <form key={p.id} action={basculerRupture}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="rupture" value="false" />
                    <button className="text-xs rounded-lg px-3 py-1.5 border border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-800">
                      {p.name}
                    </button>
                  </form>
                ))}
            </div>
          </details>
        </div>

        <form action={publierStoryDuJour} className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
          <input type="hidden" name="theme" value="vert" />
          <input type="hidden" name="meteo" value={resumeMeteo} />
          <div className="font-bold text-[#12211c]">Story « on est là aujourd&apos;hui »</div>
          <p className="text-sm text-gray-500 mt-1">
            Le lieu du jour en grand, vos horaires, votre photo. Elle part telle quelle, sans passer par le studio.
          </p>

          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {photos.map((ph, n) => (
                <label key={ph.chemin} className="cursor-pointer">
                  <input type="radio" name="media" value={ph.chemin} defaultChecked={n === 0} className="sr-only peer" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ph.url}
                    alt=""
                    className="w-14 h-14 object-cover rounded-lg border-2 border-gray-200 peer-checked:border-[#0f6b53]"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-4 items-center flex-wrap mt-4 pt-4 border-t border-gray-100 text-sm">
            <label className={`flex items-center gap-1.5 ${igPret ? "" : "text-gray-400"}`}>
              <input type="checkbox" name="instagram" defaultChecked={igPret} disabled={!igPret} className="w-4 h-4 accent-[#0f6b53]" />
              Story Instagram
            </label>
            <label className={`flex items-center gap-1.5 ${fbPret ? "" : "text-gray-400"}`}>
              <input type="checkbox" name="facebook" defaultChecked={false} disabled={!fbPret} className="w-4 h-4 accent-[#0f6b53]" />
              Page Facebook
            </label>
            <button
              disabled={annulee || (!igPret && !fbPret)}
              className="ml-auto bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            >
              Publier maintenant
            </button>
          </div>
        </form>

        <form
          action={basculerJourAuto}
          className={`mt-4 rounded-xl border p-5 flex items-center gap-4 flex-wrap ${
            jourAuto ? "border-[#c8e2da] bg-[#f7fbf9]" : "border-gray-200 bg-white"
          }`}
        >
          <input type="hidden" name="actif" value={String(jourAuto)} />
          <div className="flex-1 min-w-[240px]">
            <div className="font-bold text-[#12211c]">Story du matin automatique</div>
            <div className="text-sm text-gray-500">
              Les jours où vous avez un service, la story part toute seule avec votre dernière photo. Les jours de
              repos, rien n&apos;est publié.
            </div>
          </div>
          <label className="text-sm text-gray-600 flex items-center gap-2">
            à
            <select name="heure" defaultValue={String(heureAuto)} className="border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
              {[7, 8, 9, 10, 11].map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </label>
          <span
            className={`text-[11px] font-bold uppercase rounded-full px-3 py-1 ${
              jourAuto ? "bg-[#e5f2ee] text-[#0f6b53]" : "bg-gray-100 text-gray-500"
            }`}
          >
            {jourAuto ? `activée à ${heureAuto}h` : "coupée"}
          </span>
          <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
            {jourAuto ? "Couper" : "Activer"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6">
          La météo vient d&apos;Open-Meteo, gratuitement et sans compte, à l&apos;heure de chaque service et sur le lieu
          exact que vous avez saisi.
        </p>
      </div>
    </main>
  );
}
