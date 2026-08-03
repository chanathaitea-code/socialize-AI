/**
 * Moteur de scoring — section 3.5 du cahier des charges.
 *
 * Deux règles gouvernent ce fichier :
 *
 * 1. Le score est explicable. Chaque critère renvoie sa valeur normalisée, son
 *    poids, sa contribution et une phrase en français lisible par le client.
 *    L'écran affiche cette décomposition, jamais le seul nombre final.
 *
 * 2. Une donnée manquante n'est pas une donnée nulle. Un critère sans signal
 *    est retiré du calcul et les poids restants sont renormalisés. Compter un
 *    parking inconnu comme un parking absent ferait chuter des lieux corrects
 *    et enseignerait au client à ne pas croire le score.
 *
 * Fonction pure, sans accès réseau ni base : testable et rejouable sur
 * l'historique quand les poids changent.
 */

export type Criterion =
  | "volume"
  | "place_quality"
  | "recurrence"
  | "competition"
  | "authorization_ease"
  | "purchasing_power"
  | "distance"
  | "slot_fit"
  | "signal_freshness";

export type Confidence = "certain" | "probable" | "estimated";

export const CRITERION_LABELS: Record<Criterion, string> = {
  volume: "Monde sur place",
  place_quality: "Qualité du lieu",
  recurrence: "Potentiel de récurrence",
  competition: "Concurrence à proximité",
  authorization_ease: "Facilité d'autorisation",
  purchasing_power: "Pouvoir d'achat de la zone",
  distance: "Distance depuis la base",
  slot_fit: "Créneau compatible",
  signal_freshness: "Fraîcheur du signal",
};

export const BASELINE_WEIGHTS: Record<Criterion, number> = {
  volume: 20,
  place_quality: 18,
  recurrence: 14,
  competition: 12,
  authorization_ease: 12,
  purchasing_power: 8,
  distance: 8,
  slot_fit: 5,
  signal_freshness: 3,
};

export type ParkingEstimate = "none" | "small" | "large" | "unknown";
export type AccessEstimate = "easy" | "tight" | "blocked" | "unknown";
export type AuthorizationRegime =
  | "public_domain"
  | "market"
  | "private_domain"
  | "event_organizer"
  | "unknown";

/** Signaux disponibles pour une opportunité. Tout est optionnel : c'est la règle 2. */
export interface OpportunitySignals {
  headcount?: number | null;
  footfall?: number | null;
  parking?: ParkingEstimate | null;
  access?: AccessEstimate | null;
  hasPower?: boolean | null;
  needsPower?: boolean;
  nearbyFoodCount?: number | null;
  hasCanteen?: boolean | null;
  purchasingPowerIndex?: number | null; // 0 à 100, revenu médian rapporté au national
  authorizationRegime?: AuthorizationRegime | null;
  weeklyRecurrencePossible?: boolean | null;
  distanceKm?: number | null;
  radiusKm?: number;
  slotMatchesAvailability?: boolean | null;
  companyAgeMonths?: number | null;
}

export interface ScoreComponent {
  criterion: Criterion;
  label: string;
  value: number; // 0 à 1
  weight: number; // poids renormalisé, en points sur 100
  contribution: number; // points effectivement apportés au score
  confidence: Confidence;
  explanation: string;
}

/**
 * Un verrou n'est pas un critère pondéré.
 *
 * Constat fait en faisant tourner le moteur sur des lieux réels : traiter la
 * cantine comme un malus de 12 points laissait un hôpital et deux campus dans
 * le haut du classement. Or une cantine sur place n'est pas un désavantage,
 * c'est une porte fermée — c'est le premier motif de perte du métier.
 *
 * Un verrou écarte le lieu quel que soit son score par ailleurs. Il ne le
 * supprime pas : le lieu reste consultable avec son motif, parce qu'une
 * hypothèse de lecture peut être fausse et que le client doit pouvoir la
 * contredire.
 */
export interface Blocker {
  reason: "canteen" | "no_parking" | "blocked_access" | "saturated";
  label: string;
}

const BLOCKER_LABELS: Record<Blocker["reason"], string> = {
  canteen: "Cantine ou restauration sur place",
  no_parking: "Aucun stationnement possible",
  blocked_access: "Accès impossible pour un véhicule long",
  saturated: "Restauration déjà saturée sur le site",
};

function findBlockers(s: OpportunitySignals): Blocker[] {
  const out: Blocker[] = [];
  if (s.hasCanteen === true)
    out.push({ reason: "canteen", label: BLOCKER_LABELS.canteen });
  if (s.parking === "none")
    out.push({ reason: "no_parking", label: BLOCKER_LABELS.no_parking });
  if (s.access === "blocked")
    out.push({ reason: "blocked_access", label: BLOCKER_LABELS.blocked_access });
  if ((s.nearbyFoodCount ?? 0) >= 8)
    out.push({ reason: "saturated", label: BLOCKER_LABELS.saturated });
  return out;
}

export interface ScoreResult {
  score: number; // 0 à 100
  tier: 1 | 2 | 3 | 4 | 5;
  components: ScoreComponent[];
  missing: Criterion[];
  coverage: number; // part des poids couverte par des signaux réels, 0 à 1
  blockers: Blocker[];
  /** Vrai dès qu'un verrou est présent. Le score reste calculé et visible. */
  disqualified: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface Evaluation {
  value: number;
  confidence: Confidence;
  explanation: string;
}

type Evaluator = (s: OpportunitySignals) => Evaluation | null;

const EVALUATORS: Record<Criterion, Evaluator> = {
  volume: (s) => {
    const people = s.headcount ?? s.footfall;
    if (people == null) return null;
    // 50 personnes : marginal. 400 : très bon. Au-delà, le camion sature.
    const value = clamp01((people - 50) / 350);
    return {
      value,
      confidence: s.headcount != null ? "certain" : "estimated",
      explanation:
        s.headcount != null
          ? `${people} salariés déclarés sur le site`
          : `Fréquentation estimée à ${people} personnes, hypothèse à vérifier sur place`,
    };
  },

  place_quality: (s) => {
    if (s.parking == null && s.access == null) return null;
    let value = 0.5;
    const notes: string[] = [];

    if (s.parking === "large") { value += 0.3; notes.push("parking large"); }
    else if (s.parking === "small") { value += 0.1; notes.push("parking limité"); }
    else if (s.parking === "none") { value -= 0.35; notes.push("pas de parking identifié"); }

    if (s.access === "easy") { value += 0.2; notes.push("accès dégagé"); }
    else if (s.access === "tight") { value -= 0.15; notes.push("accès étroit pour un camion long"); }
    else if (s.access === "blocked") { value -= 0.45; notes.push("accès bloqué"); }

    if (s.needsPower && s.hasPower === false) {
      value -= 0.2;
      notes.push("pas d'électricité alors que le camion en a besoin");
    }

    return {
      value: clamp01(value),
      confidence: "estimated",
      explanation: `${notes.join(", ")}. Estimation à confirmer par une visite.`,
    };
  },

  recurrence: (s) => {
    if (s.weeklyRecurrencePossible == null) return null;
    return {
      value: s.weeklyRecurrencePossible ? 1 : 0.25,
      confidence: "estimated",
      explanation: s.weeklyRecurrencePossible
        ? "Emplacement potentiellement hebdomadaire"
        : "Ponctuel : bon chiffre d'affaires un jour, rien ensuite",
    };
  },

  competition: (s) => {
    if (s.nearbyFoodCount == null && s.hasCanteen == null) return null;
    const n = s.nearbyFoodCount ?? 0;
    return {
      value: clamp01(1 - n / 8),
      confidence: "certain",
      explanation:
        n === 0
          ? "Aucune restauration à moins de 300 mètres"
          : `${n} points de restauration à moins de 300 mètres`,
    };
  },

  authorization_ease: (s) => {
    const regime = s.authorizationRegime;
    if (regime == null || regime === "unknown") return null;
    const table: Record<Exclude<AuthorizationRegime, "unknown">, [number, string]> = {
      private_domain: [1, "Domaine privé : un accord avec le gestionnaire suffit"],
      event_organizer: [0.6, "Contrat organisateur, souvent un dossier de candidature"],
      market: [0.4, "Droits de place et régime du placier, délai communal"],
      public_domain: [0.25, "AOT communale : redevance, précaire et révocable, délai long"],
    };
    const [value, explanation] = table[regime];
    return { value, confidence: "certain", explanation };
  },

  purchasing_power: (s) => {
    if (s.purchasingPowerIndex == null) return null;
    return {
      value: clamp01(s.purchasingPowerIndex / 100),
      confidence: "estimated",
      explanation: `Indice de revenu de la zone : ${s.purchasingPowerIndex} sur 100`,
    };
  },

  distance: (s) => {
    if (s.distanceKm == null) return null;
    const radius = s.radiusKm ?? 30;
    return {
      value: clamp01(1 - s.distanceKm / radius),
      confidence: "certain",
      explanation: `${s.distanceKm.toFixed(0)} km depuis la base, sur un rayon de ${radius} km`,
    };
  },

  slot_fit: (s) => {
    if (s.slotMatchesAvailability == null) return null;
    return {
      value: s.slotMatchesAvailability ? 1 : 0,
      confidence: "certain",
      explanation: s.slotMatchesAvailability
        ? "Tombe sur un créneau libre"
        : "Tombe sur un créneau déjà pris",
    };
  },

  signal_freshness: (s) => {
    if (s.companyAgeMonths == null) return null;
    // Une entreprise de moins de deux ans n'a pas encore ses habitudes.
    const value = clamp01(1 - s.companyAgeMonths / 24);
    return {
      value,
      confidence: "certain",
      explanation:
        s.companyAgeMonths <= 24
          ? `Établissement créé il y a ${s.companyAgeMonths} mois : habitudes non installées`
          : "Établissement installé de longue date",
    };
  },
};

export function computeScore(
  signals: OpportunitySignals,
  weights: Partial<Record<Criterion, number>> = BASELINE_WEIGHTS,
): ScoreResult {
  const evaluated: Array<{ criterion: Criterion; ev: Evaluation; weight: number }> = [];
  const missing: Criterion[] = [];

  for (const key of Object.keys(EVALUATORS) as Criterion[]) {
    const weight = weights[key] ?? BASELINE_WEIGHTS[key];
    const ev = EVALUATORS[key](signals);
    if (ev === null || weight <= 0) {
      missing.push(key);
      continue;
    }
    evaluated.push({ criterion: key, ev, weight });
  }

  const totalWeight = evaluated.reduce((sum, e) => sum + e.weight, 0);
  const baselineTotal = Object.values(BASELINE_WEIGHTS).reduce((a, b) => a + b, 0);

  const blockers = findBlockers(signals);

  if (totalWeight === 0) {
    return {
      score: 0,
      tier: 1,
      components: [],
      missing,
      coverage: 0,
      blockers,
      disqualified: blockers.length > 0,
    };
  }

  const components: ScoreComponent[] = evaluated.map(({ criterion, ev, weight }) => {
    const normalizedWeight = (weight / totalWeight) * 100;
    return {
      criterion,
      label: CRITERION_LABELS[criterion],
      value: ev.value,
      weight: Math.round(normalizedWeight * 10) / 10,
      contribution: Math.round(normalizedWeight * ev.value * 10) / 10,
      confidence: ev.confidence,
      explanation: ev.explanation,
    };
  });

  const score = Math.round(components.reduce((sum, c) => sum + c.contribution, 0));

  return {
    score,
    // Un verrou ramène au dernier niveau quel que soit le score obtenu.
    tier: blockers.length > 0 ? 1 : tierFor(score),
    components: components.sort((a, b) => b.contribution - a.contribution),
    missing,
    coverage: totalWeight / baselineTotal,
    blockers,
    disqualified: blockers.length > 0,
  };
}

export function tierFor(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 50) return 3;
  if (score >= 35) return 2;
  return 1;
}

export const TIER_LABELS: Record<number, string> = {
  5: "Priorité absolue",
  4: "Très intéressant",
  3: "Moyen",
  2: "Faible",
  1: "Écarté",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  certain: "Source officielle",
  probable: "Enrichissement, à confirmer",
  estimated: "Estimation de l'application",
};

/** Distance à vol d'oiseau, en kilomètres. Suffisant pour trier, pas pour router. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
