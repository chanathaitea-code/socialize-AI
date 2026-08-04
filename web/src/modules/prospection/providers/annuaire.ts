/**
 * Couche DataProvider — famille « annuaire de l'administration ».
 *
 * L'API de l'annuaire du service public (DILA) expose en open data, sans clé,
 * les coordonnées des administrations, dont les mairies. On l'interroge par code
 * INSEE de commune pour récupérer l'e-mail générique et le téléphone du standard
 * de la mairie.
 *
 * Ce contact n'est PAS celui de l'organisateur : c'est la mairie. Il est donc
 * marqué en confiance « estimated » à l'insertion (data_sources_log), et jamais
 * présenté comme le contact direct de l'événement. Si l'annuaire ne donne rien,
 * on n'invente rien.
 */

export interface MairieContact {
  email: string | null;
  phone: string | null;
}

export interface AnnuaireProvider {
  readonly name: string;
  lookupByInsee(insee: string): Promise<MairieContact | null>;
  /** Repli quand le code INSEE manque : commune + code postal. */
  lookupByCommune(
    city: string | null,
    postalCode: string | null,
  ): Promise<MairieContact | null>;
}

const BASE_URL =
  "https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records";
/** API Géo (DINUM), publique et sans clé : code postal + commune → code INSEE. */
const GEO_URL = "https://geo.api.gouv.fr/communes";

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MIN_INTERVAL_MS = 200;
let lastCall = 0;
async function throttle() {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

interface AnnuaireRecord {
  nom?: string | null;
  pivot?: string | null;
  telephone?: string | null;
  adresse_courriel?: string | null;
}

/** `pivot` est un JSON sérialisé : [{ type_service_local: "mairie", ... }]. */
function isMairie(r: AnnuaireRecord): boolean {
  if (r.pivot) {
    try {
      const arr = JSON.parse(r.pivot) as Array<{ type_service_local?: string }>;
      if (arr.some((p) => p.type_service_local === "mairie")) return true;
    } catch {
      // pivot illisible : on retombe sur le nom
    }
  }
  return /^mairie\b/i.test(r.nom ?? "");
}

/** `telephone` est un JSON sérialisé : [{ valeur: "01 ..." }]. */
function firstPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as Array<{ valeur?: string }>;
    const v = arr.find((p) => p.valeur)?.valeur;
    return v ?? null;
  } catch {
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
}

export class ServicePublicAnnuaire implements AnnuaireProvider {
  readonly name = "annuaire.service-public.fr";

  async lookupByInsee(insee: string): Promise<MairieContact | null> {
    if (!/^\d[\dAB]\d{3}$/.test(insee)) return null;
    await throttle();

    const params = new URLSearchParams({
      where: `code_insee_commune="${insee}"`,
      select: "nom,pivot,telephone,adresse_courriel",
      limit: "20",
    });
    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { results?: AnnuaireRecord[] };
    const mairie = (body.results ?? []).find(isMairie);
    if (!mairie) return null;

    const email = mairie.adresse_courriel?.trim() || null;
    const phone = firstPhone(mairie.telephone);
    if (!email && !phone) return null;
    return { email, phone };
  }

  /**
   * Résout le code INSEE depuis un code postal et un nom de commune. Un code
   * postal couvre souvent plusieurs communes : on lève l'ambiguïté par le nom.
   */
  private async resolveInsee(
    city: string | null,
    postalCode: string | null,
  ): Promise<string | null> {
    const cp = (postalCode ?? "").trim();
    if (!/^\d{5}$/.test(cp)) return null;
    await throttle();
    const res = await fetch(`${GEO_URL}?codePostal=${cp}&fields=code,nom`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const communes = (await res.json()) as Array<{ code?: string; nom?: string }>;
    if (communes.length === 0) return null;
    if (communes.length === 1) return communes[0].code ?? null;
    const target = normalizeName(city ?? "");
    const match = communes.find((c) => normalizeName(c.nom ?? "") === target);
    return match?.code ?? null;
  }

  async lookupByCommune(
    city: string | null,
    postalCode: string | null,
  ): Promise<MairieContact | null> {
    const insee = await this.resolveInsee(city, postalCode);
    if (!insee) return null;
    return this.lookupByInsee(insee);
  }
}
