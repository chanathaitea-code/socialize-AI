/**
 * Couche DataProvider — famille « événements ».
 *
 * Même forme que providers/entreprises.ts : une interface, une implémentation,
 * un limiteur. L'application ne dépend d'aucune source unique.
 *
 * Implémentation retenue : le jeu de données public OpenAgenda agrégé par
 * Opendatasoft (`evenements-publics-openagenda`). C'est de la donnée OpenAgenda,
 * exposée nationalement via l'API Explore v2.1 — publique, sans clé, filtrable
 * par code postal et par date. Aucune clé n'est donc nécessaire ; si un jour on
 * bascule sur l'API OpenAgenda native (par agenda), la clé se lira dans
 * l'environnement (OPENAGENDA_API_KEY) et ne partira jamais au navigateur.
 *
 * On ne scrape rien : cette source est faite pour être interrogée.
 */

export interface EventRecord {
  /** Identifiant stable de la source, base du dédoublonnage. */
  sourceId: string;
  title: string;
  startsOn: string | null; // AAAA-MM-JJ
  endsOn: string | null; // AAAA-MM-JJ
  organizer: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string | null;
  /** Mots-clés libres de la source, utilisés pour le tri des formats. */
  keywords: string[];
  /** L'événement se tient sur place (pas en ligne). */
  physical: boolean;
  /** Durée de la première occurrence, en heures. Null si indéterminable. */
  durationHours: number | null;
}

export interface EventQuery {
  /** Codes de département surveillés (75, 91…). Filtre par préfixe de code postal. */
  departmentCodes: readonly string[];
  /** Ne remonter que les événements dont la fin est postérieure à cette date. */
  fromDate: string; // AAAA-MM-JJ
  limit?: number;
  offset?: number;
}

export interface EventPage {
  results: EventRecord[];
  total: number;
}

export interface EvenementsProvider {
  readonly name: string;
  search(query: EventQuery): Promise<EventPage>;
}

const BASE_URL =
  "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records";

/** Source publique et généreuse, mais on reste poli : une requête à la fois. */
const MIN_INTERVAL_MS = 250;
let lastCall = 0;
async function throttle() {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface ApiRecord {
  uid?: string | number;
  title_fr?: string | null;
  description_fr?: string | null;
  keywords_fr?: string[] | null;
  firstdate_begin?: string | null;
  firstdate_end?: string | null;
  lastdate_end?: string | null;
  attendancemode?: { id?: number } | null;
  location_name?: string | null;
  location_address?: string | null;
  location_postalcode?: string | null;
  location_city?: string | null;
  location_department?: string | null;
  location_coordinates?: { lat?: number; lon?: number } | [number, number] | null;
  contributor_organization?: string | null;
  contributor_contactname?: string | null;
  contributor_email?: string | null;
  contributor_contactnumber?: string | null;
  canonicalurl?: string | null;
}

function toDate(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.slice(0, 10);
}

function durationHours(
  begin: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!begin || !end) return null;
  const a = new Date(begin).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return (b - a) / 3_600_000;
}

function coords(
  c: ApiRecord["location_coordinates"],
): { lat: number | null; lng: number | null } {
  if (!c) return { lat: null, lng: null };
  if (Array.isArray(c)) return { lat: c[0] ?? null, lng: c[1] ?? null };
  return { lat: c.lat ?? null, lng: c.lon ?? null };
}

function mapRecord(r: ApiRecord): EventRecord | null {
  if (!r.uid || !r.title_fr) return null;
  const { lat, lng } = coords(r.location_coordinates);
  return {
    sourceId: String(r.uid),
    title: r.title_fr,
    startsOn: toDate(r.firstdate_begin),
    endsOn: toDate(r.lastdate_end),
    organizer: r.contributor_organization ?? null,
    contactName: r.contributor_contactname ?? null,
    contactEmail: r.contributor_email ?? null,
    contactPhone: r.contributor_contactnumber ?? null,
    description: r.description_fr ?? null,
    address: r.location_address ?? null,
    postalCode: r.location_postalcode ?? null,
    city: r.location_city ?? null,
    department: r.location_department ?? null,
    lat,
    lng,
    sourceUrl: r.canonicalurl ?? null,
    keywords: Array.isArray(r.keywords_fr) ? r.keywords_fr : [],
    physical: (r.attendancemode?.id ?? 1) !== 2,
    durationHours: durationHours(r.firstdate_begin, r.firstdate_end),
  };
}

/**
 * Tri des formats à l'ingestion, pas seulement à l'affichage.
 *
 * On garde ce qui a du sens pour un camion : un événement public, sur place,
 * qui dure au moins une demi-journée. On écarte les formats de salle — les
 * quatre nommés (conférence, lecture, exposition, atelier) et leurs cousins
 * évidents (colloque, séminaire, projection, stage…). On ne cherche pas à
 * détecter le plein air par un signal positif, qui manquerait la moitié des
 * marchés : on retire les formats clos, et ce qui reste tient dehors.
 *
 * Renvoie la raison du rejet, ou null si l'événement est retenu.
 */
const MIN_DURATION_HOURS = 4;

const INDOOR_FORMATS = [
  // conférence
  "conference", "colloque", "seminaire", "table ronde", "debat",
  // lecture
  "lecture", "rencontre litteraire", "dedicace",
  // exposition
  "exposition", "expo", "vernissage", "installation artistique",
  // atelier
  "atelier", "stage", "cours", "initiation", "formation", "masterclass",
  "master class", "workshop",
  // autres formats clairement en salle
  "projection", "cinema", "seance",
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// Pluriel toléré (`atelier`/`ateliers`, `stage`/`stages`) via un `s?` final.
const INDOOR_RE = new RegExp(
  "\\b(" + INDOOR_FORMATS.map((t) => t.replace(/ /g, "\\s+")).join("|") + ")s?\\b",
);

export function classifyEvent(ev: EventRecord): string | null {
  if (!ev.physical) return "en ligne";
  if (ev.durationHours != null && ev.durationHours < MIN_DURATION_HOURS) {
    return "moins d'une demi-journée";
  }
  const haystack = normalize([ev.title, ...ev.keywords].join(" "));
  const m = haystack.match(INDOOR_RE);
  if (m) return `format salle (${m[1]})`;
  return null;
}

export class OpenAgendaProvider implements EvenementsProvider {
  readonly name = "openagenda (opendatasoft)";

  async search(query: EventQuery): Promise<EventPage> {
    await throttle();

    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    // Le champ location_department porte le nom du département, pas son code :
    // on filtre donc par préfixe de code postal, stable et fiable.
    const codes = query.departmentCodes.filter((c) => /^\d{2,3}$/.test(c));
    if (codes.length === 0) return { results: [], total: 0 };
    const deptClause = codes
      .map((c) => `startswith(location_postalcode, "${c}")`)
      .join(" or ");
    const where = `(${deptClause}) and lastdate_end >= "${query.fromDate}"`;

    const params = new URLSearchParams({
      where,
      order_by: "firstdate_begin",
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!res.ok) {
      throw new Error(`OpenAgenda (opendatasoft) a répondu ${res.status}.`);
    }

    const body = (await res.json()) as {
      results?: ApiRecord[];
      total_count?: number;
    };
    return {
      results: (body.results ?? []).map(mapRecord).filter(Boolean) as EventRecord[],
      total: body.total_count ?? 0,
    };
  }
}
