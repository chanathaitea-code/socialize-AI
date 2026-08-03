/** Utilitaires de semaine, partagés par les écrans Emplacements et Story. */

export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Lundi de la semaine décalée de `offsetWeeks` par rapport à aujourd'hui. */
export function mondayOf(offsetWeeks: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offsetWeeks * 7);
  return d;
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Décalage de semaine borné, lu depuis une URL ou un formulaire. */
export function clampWeek(raw: unknown): number {
  const n = parseInt(String(raw ?? "0"), 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(-12, Math.min(12, n));
}

/** « du 3 au 9 août » */
export function libellePeriode(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const memeMois = monday.getUTCMonth() === sunday.getUTCMonth();
  return memeMois
    ? `du ${monday.getUTCDate()} au ${sunday.getUTCDate()} ${MOIS[sunday.getUTCMonth()]}`
    : `du ${monday.getUTCDate()} ${MOIS[monday.getUTCMonth()]} au ${sunday.getUTCDate()} ${MOIS[sunday.getUTCMonth()]}`;
}

/** Décalage de Paris (en millisecondes) à un instant donné. */
function decalageParis(d: Date): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const commeUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
  return commeUtc - d.getTime();
}

/**
 * Une saisie « 2026-08-03T11:42 » vient d'un champ date-heure du navigateur :
 * l'utilisateur pense en heure de Paris. Le serveur, lui, vit en UTC : sans
 * cette conversion, l'envoi partait deux heures trop tard.
 */
export function depuisSaisieParis(saisie: string): Date {
  const naif = new Date(saisie + ":00Z");
  if (Number.isNaN(naif.getTime())) return new Date(NaN);
  return new Date(naif.getTime() - decalageParis(naif));
}

/** L'inverse : pré-remplir un champ date-heure avec une heure de Paris. */
export function versSaisieParis(d: Date): string {
  return new Date(d.getTime() + decalageParis(d)).toISOString().slice(0, 16);
}
