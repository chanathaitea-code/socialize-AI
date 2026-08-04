import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getActiveModules } from "@/lib/modules.server";
import { hasModule } from "@/lib/modules";
import { loadOpportunities, FAMILY_LABELS } from "@/modules/prospection/opportunities";
import {
  computeScore,
  BASELINE_WEIGHTS,
  type Criterion,
} from "@/modules/prospection/scoring";
import { ScoreBand } from "@/modules/prospection/score-band";
import Nav from "../../nav";

export const dynamic = "force-dynamic";

// Dates isolées du rendu (le linter interdit new Date()/Date.now() en rendu).
function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getTime();
  const n = new Date();
  const t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((d - t) / 86_400_000);
}
function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00Z"));
}
function dateRange(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  if (a && b && a !== b) return `${frDate(a)} → ${frDate(b)}`;
  return frDate((a || b) as string);
}

export default async function OpportuniteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { modules } = await getActiveModules();
  if (!hasModule(modules, "prospection")) redirect("/jour");

  const opportunities = await loadOpportunities(supabase);
  const o = opportunities.find((x) => x.id === id);
  if (!o) notFound();

  const { data: rows } = await supabase
    .from("scoring_weights")
    .select("criterion, weight");
  const weights: Record<Criterion, number> = { ...BASELINE_WEIGHTS };
  for (const r of rows ?? []) {
    weights[r.criterion as Criterion] = Number(r.weight);
  }

  const result = computeScore(
    { ...o.signals, distanceKm: o.distanceKm, radiusKm: o.radiusKm },
    weights,
  );

  // Provenance des contacts : un contact venu de l'annuaire est celui de la
  // mairie (estimé), pas de l'organisateur. On ne présente pas une estimation
  // comme un fait.
  const { data: sources } = await supabase
    .from("data_sources_log")
    .select("field_name, source, confidence")
    .eq("entity_id", id);
  const sourceByField = new Map(
    (sources ?? []).map((s) => [s.field_name as string, s]),
  );
  const contactHint = (field: string): string => {
    const s = sourceByField.get(field);
    if (s?.confidence === "estimated") return "Standard de la mairie · estimé";
    return "Indiqué par la source · à confirmer";
  };

  const isEvent = o.family === "dated_event";
  const deadlineDays = o.applicationDeadline
    ? daysUntil(o.applicationDeadline)
    : null;

  const meta = [
    o.category,
    o.city,
    o.distanceKm != null ? `${o.distanceKm.toFixed(1)} km depuis la base` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/opportunites" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
          Opportunité · {FAMILY_LABELS[o.family]}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#12211c]">{o.name}</h2>
        {meta && <p className="mt-1 text-sm text-gray-500">{meta}</p>}

        {isEvent && (dateRange(o.startsOn, o.endsOn) || o.applicationDeadline) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Dates
              </p>
              <p className="mt-1 text-sm font-semibold text-[#12211c]">
                {dateRange(o.startsOn, o.endsOn) ?? "à préciser"}
              </p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                deadlineDays != null && deadlineDays <= 7
                  ? "border-red-200 bg-red-50"
                  : o.applicationDeadline
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-white"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Date limite de candidature
              </p>
              {o.applicationDeadline ? (
                <p className="mt-1 text-sm font-semibold text-[#12211c]">
                  {frDate(o.applicationDeadline)}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                      (deadlineDays ?? 0) <= 7
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    J-{deadlineDays}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">non précisée</p>
              )}
            </div>
          </div>
        )}

        {(o.organizer || o.contactEmail || o.contactPhone || o.sourceUrl) && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-[#12211c]">Contact</p>
            {o.organizer && (
              <p className="mt-1 text-sm text-gray-600">
                Organisateur : {o.organizer}
              </p>
            )}
            {o.contactEmail && (
              <p className="mt-2 text-sm">
                <a
                  href={`mailto:${o.contactEmail}`}
                  className="font-semibold text-[#0f6b53] underline underline-offset-2"
                >
                  {o.contactEmail}
                </a>
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {contactHint("contact_email")}
                </span>
              </p>
            )}
            {o.contactPhone && (
              <p className="mt-2 text-sm">
                <a
                  href={`tel:${o.contactPhone.replace(/\s/g, "")}`}
                  className="font-semibold text-[#0f6b53] underline underline-offset-2"
                >
                  {o.contactPhone}
                </a>
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {contactHint("contact_phone")}
                </span>
              </p>
            )}
            {o.sourceUrl && (
              <p className="mt-2 text-sm">
                <a
                  href={o.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 underline underline-offset-2 hover:text-[#0f6b53]"
                >
                  Voir l&apos;annonce à la source
                </a>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 md:p-8">
          <ScoreBand result={result} />
        </div>

        {o.readingNote && (
          <div className="mt-6 rounded-xl border-l-4 border-[#12211c] bg-white p-5">
            <p className="text-sm font-semibold text-[#12211c]">
              Ce que disent les signaux publics
            </p>
            <p className="mt-1 text-sm text-gray-600">{o.readingNote}</p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Lecture non vérifiée
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {o.phone && (
            <a
              href={`tel:${o.phone.replace(/\s/g, "")}`}
              className="rounded-lg bg-[#0f6b53] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Appeler {o.phone}
            </a>
          )}
          <Link
            href="/opportunites"
            className="text-sm text-gray-500 underline underline-offset-2 hover:text-[#0f6b53]"
          >
            Retour au classement
          </Link>
        </div>
      </div>
    </main>
  );
}
