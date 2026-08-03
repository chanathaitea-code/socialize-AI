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
          {o.phone ? (
            <a
              href={`tel:${o.phone.replace(/\s/g, "")}`}
              className="rounded-lg bg-[#0f6b53] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Appeler {o.phone}
            </a>
          ) : (
            <p className="text-sm text-gray-500">
              Aucun numéro public. Passer par le site ou une visite.
            </p>
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
