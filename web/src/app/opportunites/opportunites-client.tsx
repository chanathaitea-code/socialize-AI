"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BASELINE_WEIGHTS,
  CRITERION_LABELS,
  TIER_LABELS,
  type Criterion,
} from "@/modules/prospection/scoring";
import {
  rankOpportunities,
  FAMILY_LABELS,
  type Family,
  type Opportunity,
} from "@/modules/prospection/opportunities";

const TIER_COLOR: Record<number, string> = {
  5: "#0f6b53",
  4: "#3ba676",
  3: "#c99a2e",
  2: "#9aa39c",
  1: "#b4bbb5",
};

const CRITERIA = Object.keys(BASELINE_WEIGHTS) as Criterion[];

export default function OpportunitesClient({
  opportunities,
  initialWeights,
}: {
  opportunities: Opportunity[];
  initialWeights: Record<Criterion, number>;
}) {
  const [weights, setWeights] = useState<Record<Criterion, number>>({
    ...initialWeights,
  });
  const [family, setFamily] = useState<Family | "all">("all");
  const [showWeights, setShowWeights] = useState(false);

  const ranked = useMemo(
    () => rankOpportunities(opportunities, weights),
    [opportunities, weights],
  );
  const shown = ranked.filter((o) => family === "all" || o.family === family);
  const total = CRITERIA.reduce((s, c) => s + weights[c], 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h2 className="text-xl font-bold text-[#12211c]">Opportunités</h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-500">
        {opportunities.length} lieu{opportunities.length > 1 ? "x" : ""} de la
        marque, classé{opportunities.length > 1 ? "s" : ""} par score. Les poids
        sont les vôtres : bougez-en un et le classement se recalcule sous vos
        yeux.
      </p>

      {opportunities.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[#c8e2da] bg-[#f7fbf9] p-6">
          <p className="text-sm font-semibold text-[#12211c]">
            Aucune opportunité pour le moment
          </p>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Le moteur classe des lieux réels dès qu&apos;ils sont relevés.
            Commencez par mesurer et balayer un territoire — les établissements
            ramenés alimenteront ce classement.
          </p>
          <Link
            href="/territoire"
            className="mt-4 inline-block rounded-lg bg-[#0f6b53] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Aller au Territoire
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["all", "daily_flow", "periodic_flow"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  family === f
                    ? "bg-[#0f6b53] text-white"
                    : "border border-gray-300 bg-white text-gray-600 hover:border-[#0f6b53]"
                }`}
              >
                {f === "all" ? "Tout" : FAMILY_LABELS[f]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowWeights((v) => !v)}
              className="ml-auto text-sm font-semibold text-[#0f6b53] underline underline-offset-4"
            >
              {showWeights ? "Masquer les poids" : "Régler les poids"}
            </button>
          </div>

          {showWeights && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold text-[#12211c]">
                  Poids des critères
                </p>
                <p className="text-xs tabular-nums text-gray-500">
                  total {Math.round(total)} / 100
                </p>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {CRITERIA.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-3 text-sm text-[#12211c]"
                  >
                    <span className="flex-1">{CRITERION_LABELS[c]}</span>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={weights[c]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          [c]: Number(e.target.value),
                        }))
                      }
                      className="w-32 accent-[#0f6b53]"
                    />
                    <span className="w-7 text-right text-xs tabular-nums">
                      {weights[c]}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setWeights({ ...initialWeights })}
                className="mt-4 text-sm text-gray-500 underline underline-offset-2 hover:text-[#0f6b53]"
              >
                Revenir aux poids enregistrés
              </button>
            </div>
          )}

          <p className="mt-8 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {shown.filter((o) => !o.result.disqualified).length} retenus ·{" "}
            {shown.filter((o) => o.result.disqualified).length} écartés par un
            verrou
          </p>

          <ul className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {shown.map((o, i) => (
              <li key={o.id} className="border-b border-gray-100 last:border-b-0">
                <Link
                  href={`/opportunites/${o.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#f7fbf9]"
                >
                  <span className="w-6 shrink-0 text-xs tabular-nums text-gray-400">
                    {i + 1}
                  </span>
                  <span
                    className={`w-9 shrink-0 text-xl font-bold tabular-nums ${
                      o.result.disqualified ? "text-gray-400" : "text-[#12211c]"
                    }`}
                  >
                    {o.result.score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${
                        o.result.disqualified
                          ? "text-gray-500 line-through"
                          : "text-[#12211c]"
                      }`}
                    >
                      {o.name}
                    </span>
                    <span className="block text-sm text-gray-500">
                      {o.result.disqualified
                        ? o.result.blockers.map((b) => b.label).join(" · ")
                        : [
                            o.category,
                            o.city,
                            o.distanceKm != null
                              ? `${o.distanceKm.toFixed(0)} km`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <span
                    className="hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white sm:block"
                    style={{ backgroundColor: TIER_COLOR[o.result.tier] }}
                  >
                    {TIER_LABELS[o.result.tier]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 rounded-xl border-l-4 border-[#0f6b53] bg-white p-5">
        <p className="text-sm font-semibold text-[#12211c]">
          Ce que dit le score
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Le score n&apos;est pas un verdict mais une lecture : chaque lieu ouvre
          sa décomposition, critère par critère, avec le niveau de confiance de
          chaque signal. Une donnée manquante est retirée du calcul, pas comptée
          comme nulle. Un verrou — cantine, stationnement, accès, saturation —
          écarte le lieu sans le supprimer, pour que vous puissiez contredire une
          hypothèse fausse.
        </p>
      </div>
    </div>
  );
}
