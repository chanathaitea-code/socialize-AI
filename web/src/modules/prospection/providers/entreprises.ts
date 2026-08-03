/**
 * Couche DataProvider — famille « entreprises ».
 *
 * Même principe que PublishingProvider et ImageProvider : l'application ne
 * dépend d'aucune source unique. Les conditions et les tarifs des API évoluent
 * vite, et une source qui ferme ne doit pas emporter le module.
 *
 * Implémentation retenue au lancement : l'API Recherche d'entreprises de la
 * DINUM (recherche-entreprises.api.gouv.fr). Gratuite, sans clé, sans quota
 * facturé, adossée à SIRENE et au RNE. C'est ce qui rend la couverture
 * nationale possible sans budget de données.
 *
 * Limite documentée : 7 appels par seconde. Le limiteur ci-dessous s'y tient
 * avec une marge, parce qu'un service public gratuit ne se martèle pas.
 */

export interface CompanyRecord {
  siren: string;
  siret: string | null;
  name: string;
  nafCode: string | null;
  nafSection: string | null;
  headcountBand: string | null;
  headcountEstimate: number | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  createdOn: string | null;
}

export interface CompanyQuery {
  /** Recherche autour d'un point. Le rayon d'action du camion, en pratique. */
  near?: { lat: number; lng: number; radiusKm: number };
  /** Recherche par département, pour un balayage large. */
  department?: string;
  nafSections?: readonly string[];
  headcountBands?: readonly string[];
  page?: number;
  perPage?: number;
}

export interface CompanyPage {
  results: CompanyRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EntrepriseProvider {
  readonly name: string;
  search(query: CompanyQuery): Promise<CompanyPage>;
  /** Compte sans rapatrier : une page d'un résultat, on ne lit que le total. */
  count(query: CompanyQuery): Promise<number>;
}

const BASE_URL = "https://recherche-entreprises.api.gouv.fr";

/** 7 appels par seconde autorisés. On se tient à 5, avec une file simple. */
const MIN_INTERVAL_MS = 200;
let lastCall = 0;

async function throttle() {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface ApiEtablissement {
  siret?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
  activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  etat_administratif?: string | null;
}

interface ApiResult {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  date_creation?: string | null;
  tranche_effectif_salarie?: string | null;
  siege?: ApiEtablissement;
  matching_etablissements?: ApiEtablissement[];
}

const BAND_MIDPOINTS: Record<string, number> = {
  "01": 2, "02": 4, "03": 7, "11": 15, "12": 35, "21": 75,
  "22": 150, "31": 225, "32": 375, "41": 750, "42": 1500,
  "51": 3500, "52": 7500, "53": 15000,
};

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function mapResult(r: ApiResult): CompanyRecord | null {
  const etab = r.matching_etablissements?.[0] ?? r.siege;
  if (!r.siren) return null;

  const band = etab?.tranche_effectif_salarie ?? r.tranche_effectif_salarie ?? null;
  const naf = etab?.activite_principale ?? null;

  return {
    siren: r.siren,
    siret: etab?.siret ?? null,
    name: r.nom_complet ?? r.nom_raison_sociale ?? "Sans dénomination",
    nafCode: naf,
    nafSection: null,
    headcountBand: band,
    headcountEstimate: band ? (BAND_MIDPOINTS[band] ?? null) : null,
    address: etab?.adresse ?? null,
    postalCode: etab?.code_postal ?? null,
    city: etab?.libelle_commune ?? null,
    lat: toNumber(etab?.latitude),
    lng: toNumber(etab?.longitude),
    createdOn: r.date_creation ?? null,
  };
}

export class EntreprisesGouvProvider implements EntrepriseProvider {
  readonly name = "recherche-entreprises.api.gouv.fr";

  async search(query: CompanyQuery): Promise<CompanyPage> {
    await throttle();

    const perPage = Math.min(query.perPage ?? 25, 25);
    const page = query.page ?? 1;
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      etat_administratif: "A",
    });

    let endpoint: string;

    if (query.near) {
      endpoint = "/near_point";
      params.set("lat", String(query.near.lat));
      params.set("long", String(query.near.lng));
      params.set("radius", String(Math.min(query.near.radiusKm, 50)));
    } else {
      endpoint = "/search";
      if (query.department) params.set("departement", query.department);
    }

    if (query.nafSections?.length) {
      params.set("section_activite_principale", query.nafSections.join(","));
    }
    if (query.headcountBands?.length) {
      params.set("tranche_effectif_salarie", query.headcountBands.join(","));
    }

    const res = await fetch(`${BASE_URL}${endpoint}?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) {
      throw new Error(
        `Recherche d'entreprises a répondu ${res.status}. ` +
          `Le service est public et gratuit : en cas de 429, ralentir plutôt que réessayer.`,
      );
    }

    const body = (await res.json()) as {
      results?: ApiResult[];
      total_results?: number;
      page?: number;
      total_pages?: number;
    };

    return {
      results: (body.results ?? []).map(mapResult).filter(Boolean) as CompanyRecord[],
      total: body.total_results ?? 0,
      page: body.page ?? page,
      totalPages: body.total_pages ?? 1,
    };
  }

  async count(query: CompanyQuery): Promise<number> {
    const page = await this.search({ ...query, page: 1, perPage: 1 });
    return page.total;
  }
}
