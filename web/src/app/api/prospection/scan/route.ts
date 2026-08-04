import { NextResponse, type NextRequest } from "next/server";
import { EntreprisesGouvProvider } from "@/modules/prospection/providers/entreprises";
import { planScan, type ScanScope } from "@/modules/prospection/scan/planner";
import { TARGET_NAF_SECTIONS, bandsAbove } from "@/modules/prospection/geo/france";

/**
 * Exécute un balayage. Volontairement plafonné.
 *
 * Le plafond n'est pas une limite technique, c'est un garde-fou : une requête
 * utilisateur ne doit jamais pouvoir déclencher des heures d'appels. Un clic
 * dans l'interface reste borné ; un balayage régional complet appartient à une
 * file de fond, pas à un bouton.
 */
const MAX_CELLS_PER_REQUEST = 8;
/** Pages ramenées par cellule. 25 résultats par page côté API. */
const MAX_PAGES_PER_CELL = 4;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    scope: ScanScope;
    minHeadcount?: number;
  };

  const plan = planScan(body.scope, { minHeadcount: body.minHeadcount });
  const cells = plan.cells.slice(0, MAX_CELLS_PER_REQUEST);
  const provider = new EntreprisesGouvProvider();
  const bands = bandsAbove(body.minHeadcount ?? 100);

  const seen = new Set<string>();
  const companies = [];
  const errors: string[] = [];

  let pagesFetched = 0;

  for (const cell of cells) {
    try {
      // Pagination : une seule page ramènerait 25 résultats sur plusieurs
      // centaines attendus, et le classement serait celui de l'API, pas le nôtre.
      for (let page = 1; page <= MAX_PAGES_PER_CELL; page++) {
        const res = await provider.search({
          near: cell.near,
          department: cell.department,
          nafSections: cell.department ? TARGET_NAF_SECTIONS : undefined,
          headcountBands: bands,
          page,
          perPage: 25,
        });
        pagesFetched++;
        for (const c of res.results) {
          const key = c.siret ?? c.siren;
          if (seen.has(key)) continue;
          seen.add(key);
          companies.push(c);
        }
        if (page >= res.totalPages || res.results.length === 0) break;
      }
    } catch (e) {
      errors.push(
        `${cell.label} : ${e instanceof Error ? e.message : "échec inconnu"}`,
      );
    }
  }

  return NextResponse.json({
    plan: {
      label: plan.label,
      cellsTotal: plan.cells.length,
      cellsRun: cells.length,
      pagesFetched,
      warnings: plan.warnings,
    },
    companies,
    errors,
    truncated: plan.cells.length > MAX_CELLS_PER_REQUEST,
  });
}
