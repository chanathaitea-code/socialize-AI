import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getActiveModules } from "@/lib/modules.server";
import { hasModule } from "@/lib/modules";
import { FAMILY_LABELS, type Family } from "@/modules/prospection/opportunities";
import Nav from "../nav";
import { toggleVeille } from "./actions";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  deadlines: "Échéances",
  openagenda: "Événements",
  entreprises: "Entreprises",
};

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).getTime();
  return Math.round((d - today) / 86_400_000);
}

function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00Z"));
}

/** Fenêtres de dates. Isolé du rendu : le linter interdit Date.now() en rendu. */
function windowDates(alertDays: number) {
  const now = Date.now();
  return {
    sevenDaysAgo: new Date(now - 7 * 86_400_000).toISOString(),
    today: new Date(now).toISOString().slice(0, 10),
    horizon: new Date(now + alertDays * 86_400_000).toISOString().slice(0, 10),
  };
}

export default async function VeillePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { ok, err } = await searchParams;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { modules } = await getActiveModules();
  if (!hasModule(modules, "prospection")) redirect("/jour");

  const { data: settings } = await supabase
    .from("prospection_settings")
    .select("veille_enabled, deadline_alert_days, watched_departments")
    .limit(1)
    .maybeSingle();
  const veilleOn = settings?.veille_enabled ?? true;
  const alertDays = (settings?.deadline_alert_days as number | null) ?? 15;
  const watched = (settings?.watched_departments as string[] | null) ?? [];

  const { sevenDaysAgo, today, horizon } = windowDates(alertDays);

  const [{ data: runs }, { data: recent, count: recentCount }, { data: deadlines }] =
    await Promise.all([
      supabase
        .from("veille_runs")
        .select("source, finished_at, found, created, duplicates, error")
        .order("finished_at", { ascending: false })
        .limit(20),
      supabase
        .from("opportunities")
        .select("id, name, city, family, score, created_at", { count: "exact" })
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("opportunities")
        .select("id, name, city, application_deadline, family")
        .not("application_deadline", "is", null)
        .gte("application_deadline", today)
        .lte("application_deadline", horizon)
        .not("status", "in", "(won,lost)")
        .order("application_deadline", { ascending: true })
        .limit(15),
    ]);

  // Dernier passage par source.
  const lastBySource = new Map<string, NonNullable<typeof runs>[number]>();
  for (const r of runs ?? []) {
    if (!lastBySource.has(r.source)) lastBySource.set(r.source, r);
  }

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/veille" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#12211c]">Veille</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Chaque nuit, la veille cherche de nouvelles opportunités —
              événements et entreprises — sur vos départements surveillés
              {watched.length ? ` (${watched.join(", ")})` : ""}, et remonte les
              échéances qui approchent. Elle lit et enregistre ; elle n&apos;envoie
              rien.
            </p>
          </div>
          <form action={toggleVeille}>
            <input type="hidden" name="enable" value={String(!veilleOn)} />
            <button
              type="submit"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                veilleOn
                  ? "bg-[#0f6b53] text-white hover:opacity-90"
                  : "border border-gray-300 text-gray-600 hover:border-[#0f6b53]"
              }`}
            >
              {veilleOn ? "Veille active" : "Veille coupée"}
            </button>
          </form>
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

        {/* Échéances : le plus important. */}
        <h3 className="mt-8 text-base font-bold text-[#12211c]">
          Échéances dans les {alertDays} jours
        </h3>
        {(deadlines ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Aucune échéance imminente. Une date limite ratée coûte une année
            entière : elles apparaîtront ici dès qu&apos;une approche.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {(deadlines ?? []).map((o) => {
              const j = daysUntil(o.application_deadline as string);
              return (
                <li key={o.id} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href={`/opportunites/${o.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-[#f7fbf9]"
                  >
                    <span
                      className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold ${
                        j <= 3
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      J-{j}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#12211c]">
                        {o.name}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {[o.city, frDate(o.application_deadline as string)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Nouveautés des 7 derniers jours. */}
        <h3 className="mt-8 text-base font-bold text-[#12211c]">
          Nouveautés des 7 derniers jours
          {typeof recentCount === "number" && recentCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              {recentCount} au total{recentCount > 10 ? ", 10 affichées" : ""}
            </span>
          )}
        </h3>
        {(recent ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Rien de neuf cette semaine. La veille présente les mieux classées, le
            reste attend en base.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {(recent ?? []).map((o) => (
              <li key={o.id} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={`/opportunites/${o.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-[#f7fbf9]"
                >
                  <span className="w-9 shrink-0 text-lg font-bold tabular-nums text-[#12211c]">
                    {o.score ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#12211c]">
                      {o.name}
                    </span>
                    <span className="block text-sm text-gray-500">{o.city}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#e5f2ee] px-2 py-0.5 text-[11px] font-bold text-[#0f6b53]">
                    {FAMILY_LABELS[o.family as Family] ?? o.family}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Derniers passages, source par source. */}
        <h3 className="mt-8 text-base font-bold text-[#12211c]">Derniers passages</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {["deadlines", "openagenda", "entreprises"].map((src) => {
            const r = lastBySource.get(src);
            return (
              <div key={src} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {SOURCE_LABELS[src]}
                </p>
                {r ? (
                  <>
                    <p className="mt-1 text-sm text-[#12211c]">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Europe/Paris",
                      }).format(new Date(r.finished_at as string))}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {r.created} nouveaux · {r.duplicates} doublons · {r.found} vus
                    </p>
                    {r.error && (
                      <p className="mt-1 text-xs text-red-700">erreur : {r.error}</p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">jamais</p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Sources : OpenAgenda (données publiques agrégées, sans clé) et l&apos;API
          Recherche d&apos;entreprises de la DINUM. La veille tourne une fois par
          nuit et reprend chaque soir là où elle s&apos;était arrêtée.
        </p>
      </div>
    </main>
  );
}
