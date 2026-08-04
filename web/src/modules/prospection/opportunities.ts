import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeScore,
  haversineKm,
  type Criterion,
  type OpportunitySignals,
  type AuthorizationRegime,
  type ScoreResult,
} from "./scoring";

/**
 * Classement des opportunités.
 *
 * Le jeu de démonstration `seed.ts` a disparu : les opportunités viennent
 * désormais de la table `opportunities` via Supabase. Le client habituel suffit
 * — les policies exigent l'appartenance à la marque et le droit au module, donc
 * aucun filtrage applicatif n'est ajouté ici et surtout aucune clé de service.
 *
 * Le scoring reste une fonction pure rejouable : `loadOpportunities` ramène les
 * signaux bruts, `rankOpportunities` recalcule score et classement à chaque
 * changement de poids, dans le navigateur, sans nouvel aller-retour.
 */

export type Family = "daily_flow" | "periodic_flow" | "dated_event";

export const FAMILY_LABELS: Record<Family, string> = {
  daily_flow: "Flux quotidien",
  periodic_flow: "Flux périodique",
  dated_event: "Événement daté",
};

/** Signaux d'une opportunité, hors distance/rayon calculés au classement. */
export type OpportunityInputs = Omit<
  OpportunitySignals,
  "distanceKm" | "radiusKm"
>;

export interface Opportunity {
  id: string;
  name: string;
  category: string;
  city: string;
  family: Family;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
  phone?: string;
  /** Ce que la lecture des signaux publics a fait remonter. Non vérifié. */
  readingNote?: string;
  signals: OpportunityInputs;
  /** Rayon de la marque, pour le critère distance. */
  radiusKm: number;
  // Colonnes propres aux événements (family = dated_event).
  startsOn: string | null;
  endsOn: string | null;
  applicationDeadline: string | null;
  organizer: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sourceUrl: string | null;
}

export interface ScoredOpportunity extends Opportunity {
  result: ScoreResult;
}

const DEFAULT_RADIUS_KM = 25;

/**
 * Recalcule le classement à partir des signaux déjà chargés.
 *
 * Fonction pure : mêmes entrées, mêmes sorties. C'est elle qui tourne quand on
 * bouge un curseur de poids, sans base ni réseau.
 */
export function rankOpportunities(
  opportunities: Opportunity[],
  weights?: Partial<Record<Criterion, number>>,
): ScoredOpportunity[] {
  return opportunities
    .map((o) => ({
      ...o,
      result: computeScore(
        { ...o.signals, distanceKm: o.distanceKm, radiusKm: o.radiusKm },
        weights,
      ),
    }))
    .sort((a, b) => {
      // Les lieux écartés passent en fin de liste quel que soit leur score :
      // un verrou n'est pas une nuance de classement.
      if (a.result.disqualified !== b.result.disqualified) {
        return a.result.disqualified ? 1 : -1;
      }
      // Échéance d'abord : ce qui a une date limite prime, la plus proche en
      // tête. Pour un événement, l'échéance est l'information décisive — la
      // rater coûte une année. Le reste se classe ensuite par score.
      const ad = a.applicationDeadline;
      const bd = b.applicationDeadline;
      if (ad && bd) {
        if (ad !== bd) return ad < bd ? -1 : 1;
      } else if (ad) {
        return -1;
      } else if (bd) {
        return 1;
      }
      return b.result.score - a.result.score;
    });
}

/** Nombre de mois écoulés depuis une date de création (AAAA-MM-JJ). */
function monthsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth()),
  );
}

interface CompanyRow {
  headcount_estimate: number | null;
  created_on: string | null;
}
interface PlaceRow {
  category: string | null;
  parking_estimate: OpportunitySignals["parking"] | null;
  access_estimate: OpportunitySignals["access"] | null;
  footfall_estimate: number | null;
  nearby_food_count: number | null;
  has_canteen: boolean | null;
}
interface OpportunityRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  family: Family;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  authorization_regime: AuthorizationRegime | null;
  notes: string | null;
  starts_on: string | null;
  ends_on: string | null;
  application_deadline: string | null;
  organizer: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source_url: string | null;
  prospect_companies: CompanyRow | CompanyRow[] | null;
  prospect_places: PlaceRow | PlaceRow[] | null;
}

/** Une jointure Supabase renvoie soit un objet, soit un tableau selon la config. */
function one<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * Charge les opportunités de la marque courante depuis Supabase.
 *
 * Reçoit le client en paramètre : ce fichier ne doit importer aucune clé ni
 * `next/headers`, pour rester utilisable côté navigateur (rankOpportunities).
 */
export async function loadOpportunities(
  supabase: SupabaseClient,
): Promise<Opportunity[]> {
  const { data: settings } = await supabase
    .from("prospection_settings")
    .select("base_lat, base_lng, radius_km, needs_power")
    .limit(1)
    .maybeSingle();

  const base =
    settings?.base_lat != null && settings?.base_lng != null
      ? { lat: settings.base_lat as number, lng: settings.base_lng as number }
      : null;
  const radiusKm = (settings?.radius_km as number | undefined) ?? DEFAULT_RADIUS_KM;
  const needsPower = Boolean(settings?.needs_power);

  const { data, error } = await supabase
    .from("opportunities")
    .select(
      `id, name, city, address, family, lat, lng, distance_km,
       authorization_regime, notes,
       starts_on, ends_on, application_deadline, organizer,
       contact_name, contact_email, contact_phone, source_url,
       prospect_companies ( headcount_estimate, created_on ),
       prospect_places ( category, parking_estimate, access_estimate,
                          footfall_estimate, nearby_food_count, has_canteen )`,
    )
    .order("score", { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  return (data as unknown as OpportunityRow[]).map((row) => {
    const company = one(row.prospect_companies);
    const place = one(row.prospect_places);

    const distanceKm =
      row.distance_km ??
      (base && row.lat != null && row.lng != null
        ? Math.round(haversineKm(base, { lat: row.lat, lng: row.lng }) * 10) / 10
        : null);

    const signals: OpportunityInputs = {
      headcount: company?.headcount_estimate ?? null,
      footfall: place?.footfall_estimate ?? null,
      parking: place?.parking_estimate ?? null,
      access: place?.access_estimate ?? null,
      needsPower,
      hasPower: null,
      nearbyFoodCount: place?.nearby_food_count ?? null,
      hasCanteen: place?.has_canteen ?? null,
      authorizationRegime: row.authorization_regime ?? null,
      // La récurrence hebdomadaire se déduit de la famille : un événement daté
      // ne revient pas, un flux quotidien ou périodique le peut.
      weeklyRecurrencePossible:
        row.family === "dated_event" ? false : row.family ? true : null,
      companyAgeMonths: monthsSince(company?.created_on ?? null),
    };

    return {
      id: row.id,
      name: row.name,
      category: place?.category ?? FAMILY_LABELS[row.family] ?? "Lieu",
      city: row.city ?? "",
      family: row.family,
      lat: row.lat,
      lng: row.lng,
      distanceKm,
      readingNote: row.notes ?? undefined,
      signals,
      radiusKm,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      applicationDeadline: row.application_deadline,
      organizer: row.organizer,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      sourceUrl: row.source_url,
    };
  });
}
