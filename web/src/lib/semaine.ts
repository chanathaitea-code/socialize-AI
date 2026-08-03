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
