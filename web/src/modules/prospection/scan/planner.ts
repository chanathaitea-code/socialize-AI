import {
  DEPARTMENTS,
  TARGET_NAF_SECTIONS,
  bandsAbove,
  departmentByCode,
  departmentsOf,
} from "../geo/france";

/**
 * Planificateur de balayage.
 *
 * Règle produit : aucun balayage ne démarre sans que son volume et sa durée
 * aient été annoncés. C'est la transposition du délai de grâce du module
 * Communication — on annonce avant, on n'explique pas après.
 *
 * Le volume n'est pas estimé à partir de densités écrites en dur. Il est
 * MESURÉ, par une requête à un résultat dont on ne lit que le compteur total.
 * Un chiffre inventé qui s'affiche comme une prévision est pire qu'une case
 * vide, parce que personne ne peut le vérifier.
 */

export type ScanScope =
  | { kind: "radius"; lat: number; lng: number; radiusKm: number; label: string }
  | { kind: "departments"; codes: string[] }
  | { kind: "region"; region: string }
  | { kind: "france" };

export interface ScanCell {
  id: string;
  label: string;
  department?: string;
  near?: { lat: number; lng: number; radiusKm: number };
  /** Renseigné par la mesure, jamais deviné. */
  measured?: number;
}

export interface ScanPlan {
  scope: ScanScope;
  label: string;
  cells: ScanCell[];
  /** Nombre de requêtes nécessaires pour mesurer le volume. */
  probeCalls: number;
  warnings: string[];
}

export interface MeasuredPlan extends ScanPlan {
  totalCompanies: number;
  fetchCalls: number;
  fetchMinutes: number;
  measured: true;
}

const PER_PAGE = 25;
/** Intervalle du limiteur, plus la latence réelle de l'API. */
const CALL_INTERVAL_MS = 450;
/** L'API plafonne la pagination : au-delà, découper autrement. */
export const MAX_PAGES = 40;

export function planScan(
  scope: ScanScope,
  options: { minHeadcount?: number } = {},
): ScanPlan {
  const minHeadcount = options.minHeadcount ?? 100;
  const warnings: string[] = [];
  const cells: ScanCell[] = [];

  if (bandsAbove(minHeadcount).length === 0) {
    warnings.push(
      "Aucune tranche d'effectif ne correspond à ce seuil. Le balayage ne ramènera rien.",
    );
  }

  if (scope.kind === "radius") {
    if (scope.radiusKm > 50) {
      warnings.push(
        "L'API plafonne la recherche autour d'un point à 50 km. Au-delà, passer par les départements.",
      );
    }
    if (scope.radiusKm > 30) {
      warnings.push(
        "Au-delà de 30 km, un emplacement hebdomadaire devient difficile à tenir : trajet, carburant, heures non facturées. Le rayon utile d'un camion est de 20 à 30 km.",
      );
    }
    cells.push({
      id: "radius",
      label: scope.label,
      near: {
        lat: scope.lat,
        lng: scope.lng,
        radiusKm: Math.min(scope.radiusKm, 50),
      },
    });
  } else {
    const codes =
      scope.kind === "france"
        ? DEPARTMENTS.map((d) => d.code)
        : scope.kind === "region"
          ? departmentsOf(scope.region).map((d) => d.code)
          : scope.codes;

    for (const code of codes) {
      const dept = departmentByCode(code);
      if (!dept) continue;
      // Une cellule par section NAF : la pagination de l'API est plafonnée,
      // et un gros département dépasserait la limite en une seule requête.
      for (const section of TARGET_NAF_SECTIONS) {
        cells.push({
          id: `${code}-${section}`,
          label: `${dept.name} · section ${section}`,
          department: code,
        });
      }
    }

    if (scope.kind === "france") {
      warnings.push(
        "France entière : 101 départements. Utile pour dimensionner l'offre, pas pour un camion. Un commerce mobile travaille dans un rayon de 20 à 30 km autour de sa base.",
      );
    }
    if (codes.length === 0) {
      warnings.push("Aucun département sélectionné.");
    }
  }

  return {
    scope,
    label: describeScope(scope),
    cells,
    probeCalls: cells.length,
    warnings,
  };
}

/** Assemble le plan mesuré à partir des compteurs renvoyés par la mesure. */
export function withMeasurements(
  plan: ScanPlan,
  counts: Record<string, number>,
): MeasuredPlan {
  const cells = plan.cells.map((c) => ({ ...c, measured: counts[c.id] ?? 0 }));
  const totalCompanies = cells.reduce((s, c) => s + (c.measured ?? 0), 0);

  const fetchCalls = cells.reduce((s, c) => {
    const pages = Math.ceil((c.measured ?? 0) / PER_PAGE);
    return s + Math.min(pages, MAX_PAGES);
  }, 0);

  const warnings = [...plan.warnings];
  const overflowing = cells.filter(
    (c) => Math.ceil((c.measured ?? 0) / PER_PAGE) > MAX_PAGES,
  );
  if (overflowing.length > 0) {
    warnings.push(
      `${overflowing.length} cellule(s) dépassent la pagination de l'API. Découper par code postal, ou relever le seuil d'effectif.`,
    );
  }
  if (totalCompanies > 5000) {
    warnings.push(
      `${totalCompanies.toLocaleString("fr-FR")} établissements. Personne ne traite ça : le scoring en remontera trente par jour et le reste dormira en base. Relever le seuil d'effectif ou réduire le périmètre.`,
    );
  }

  return {
    ...plan,
    cells,
    warnings,
    totalCompanies,
    fetchCalls,
    fetchMinutes: Math.max(1, Math.round((fetchCalls * CALL_INTERVAL_MS) / 60000)),
    measured: true,
  };
}

export function describeScope(scope: ScanScope): string {
  switch (scope.kind) {
    case "radius":
      return `${scope.radiusKm} km autour de ${scope.label}`;
    case "france":
      return "France entière";
    case "region":
      return scope.region;
    case "departments": {
      const names = scope.codes
        .map((c) => departmentByCode(c)?.name ?? c)
        .join(", ");
      return names || "Aucun département";
    }
  }
}
