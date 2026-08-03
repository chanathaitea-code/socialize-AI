import {
  CONFIDENCE_LABELS,
  TIER_LABELS,
  type Confidence,
  type ScoreResult,
  CRITERION_LABELS,
} from "@/modules/prospection/scoring";

/**
 * La bande de score — l'élément central du produit.
 *
 * Le score n'est pas un badge : c'est une barre de 100 unités découpée en
 * contributions. Chaque segment est large comme le poids de son critère et
 * rempli à hauteur de ce que le lieu obtient. La partie creuse reste visible :
 * c'est le potentiel non atteint, souvent l'information la plus actionnable.
 * Lire la barre, c'est lire la raison du score.
 *
 * Rhabillé à l'identité verte de SocialFlow ; le principe est intact.
 */

/** Couleur par niveau. Vert pour les bons, ambre puis gris en descendant. */
const TIER_COLOR: Record<number, string> = {
  5: "#0f6b53",
  4: "#3ba676",
  3: "#c99a2e",
  2: "#9aa39c",
  1: "#b4bbb5",
};

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  certain: "bg-[#e5f2ee] text-[#0f6b53]",
  probable: "bg-amber-100 text-amber-800",
  estimated: "bg-gray-100 text-gray-500",
};

export function ScoreBand({ result }: { result: ScoreResult }) {
  const { score, tier, components, missing, coverage, blockers } = result;
  const color = TIER_COLOR[tier];

  return (
    <div className="w-full">
      {blockers.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-900">
            Écarté : {blockers.map((b) => b.label).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-red-800/90">
            Un verrou ne se compense pas par un bon score ailleurs. Le calcul
            reste affiché ci-dessous, parce qu&apos;une hypothèse de lecture peut
            être fausse — si le motif ne tient pas, corrigez-le et le lieu revient
            au classement.
          </p>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-extrabold leading-none text-[#12211c]">
            {score}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            sur 100
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: color }}
        >
          {TIER_LABELS[tier]}
        </span>
      </div>

      <div className="mt-4 flex h-14 w-full gap-px overflow-hidden rounded-lg bg-gray-200">
        {components.map((c) => {
          const fill = Math.round(c.value * 100);
          return (
            <div
              key={c.criterion}
              style={{ width: `${c.weight}%` }}
              className="relative bg-gray-100"
              title={`${c.label} — ${c.contribution} points sur ${c.weight}`}
            >
              <div
                className="absolute bottom-0 left-0 w-full"
                style={{ height: `${fill}%`, backgroundColor: color }}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
        Largeur = poids du critère · Hauteur = ce que le lieu obtient
      </p>

      <ul className="mt-5 divide-y divide-gray-100">
        {components.map((c) => (
          <li key={c.criterion} className="flex gap-4 py-3">
            <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-[#12211c]">
              +{c.contribution}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-[#12211c]">
                  {c.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONFIDENCE_STYLE[c.confidence]}`}
                  title={CONFIDENCE_LABELS[c.confidence]}
                >
                  {CONFIDENCE_LABELS[c.confidence]}
                </span>
              </span>
              <span className="mt-0.5 block text-sm text-gray-500">
                {c.explanation}
              </span>
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-gray-400">
              /{c.weight}
            </span>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <div className="mt-5 rounded-xl border-l-4 border-[#0f6b53] bg-[#f7fbf9] p-4">
          <p className="text-sm font-semibold text-[#12211c]">
            {missing.length} critère{missing.length > 1 ? "s" : ""} sans signal
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {missing.map((m) => CRITERION_LABELS[m]).join(", ")}. Ces critères
            sont retirés du calcul et les poids restants sont renormalisés — une
            donnée manquante ne pénalise pas le lieu. Score calculé sur{" "}
            <span className="font-bold tabular-nums">
              {Math.round(coverage * 100)} %
            </span>{" "}
            des poids.
          </p>
        </div>
      )}
    </div>
  );
}
