import { NextResponse, type NextRequest } from "next/server";
import { EntreprisesGouvProvider } from "@/modules/prospection/providers/entreprises";
import {
  planScan,
  withMeasurements,
  type ScanScope,
} from "@/modules/prospection/scan/planner";
import { TARGET_NAF_SECTIONS, bandsAbove } from "@/modules/prospection/geo/france";

/**
 * Mesure le volume d'un périmètre avant de le balayer.
 *
 * Une requête par cellule, un résultat demandé, seul le compteur total est lu.
 * C'est peu coûteux et ça remplace les densités écrites en dur — un chiffre
 * inventé affiché comme une prévision est pire qu'une case vide.
 *
 * Plafond : la France entière fait des centaines de cellules. Au-delà du
 * plafond, on mesure un échantillon et on extrapole en le disant.
 */
const MAX_PROBES = 60;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    scope: ScanScope;
    minHeadcount?: number;
  };

  const minHeadcount = body.minHeadcount ?? 100;
  const plan = planScan(body.scope, { minHeadcount });
  const provider = new EntreprisesGouvProvider();
  const bands = bandsAbove(minHeadcount);

  const probes = plan.cells.slice(0, MAX_PROBES);
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  for (const cell of probes) {
    try {
      counts[cell.id] = await provider.count({
        near: cell.near,
        department: cell.department,
        nafSections: cell.department ? TARGET_NAF_SECTIONS : undefined,
        headcountBands: bands,
      });
    } catch (e) {
      errors.push(
        `${cell.label} : ${e instanceof Error ? e.message : "mesure impossible"}`,
      );
    }
  }

  const sampled = probes.length < plan.cells.length;
  if (sampled) {
    // Extrapolation assumée et signalée, jamais présentée comme une mesure.
    const measuredAvg =
      Object.values(counts).reduce((a, b) => a + b, 0) /
      Math.max(1, Object.keys(counts).length);
    for (const cell of plan.cells.slice(MAX_PROBES)) {
      counts[cell.id] = Math.round(measuredAvg);
    }
  }

  const measured = withMeasurements(plan, counts);
  if (sampled) {
    measured.warnings.push(
      `Volume mesuré sur ${probes.length} cellules des ${plan.cells.length} du périmètre ; le reste est extrapolé à partir de cette moyenne. Le total affiché est un ordre de grandeur, pas un décompte.`,
    );
  }

  return NextResponse.json({ plan: measured, sampled, errors });
}
