/** Chartes visuelles de la story hebdomadaire, partagées par l'aperçu et l'export image. */

export type Theme = { nom: string; bg: string; accent: string; photo: string };

export const THEMES: Record<string, Theme> = {
  vert: {
    nom: "Vert Bangkok",
    bg: "linear-gradient(175deg,#0a3129,#0d4a3a 45%,#0a2e26)",
    accent: "#f3c04b",
    photo: "linear-gradient(160deg,#d9a13b,#c8501f 70%)",
  },
  nuit: {
    nom: "Nuit dorée",
    bg: "linear-gradient(175deg,#0e1520,#1d2c42 50%,#0b111b)",
    accent: "#e2b25a",
    photo: "linear-gradient(160deg,#c8a24a,#7a5716 80%)",
  },
  rose: {
    nom: "Rose bubble tea",
    bg: "linear-gradient(175deg,#2a1233,#6e2954 55%,#22101f)",
    accent: "#ff9ec4",
    photo: "linear-gradient(160deg,#e0527f,#7b2d5e 80%)",
  },
  piment: {
    nom: "Piment doux",
    bg: "linear-gradient(175deg,#4a1206,#8a2f10 55%,#3a0e05)",
    accent: "#ffcf7a",
    photo: "linear-gradient(160deg,#f3b13c,#c8501f 75%)",
  },
};

export const PHOTOS: Record<string, string> = {
  padthai: "🍜",
  crousty: "🍗",
  bubble: "🧋",
  cheffe: "👩‍🍳",
  camion: "🚚",
  poke: "🥡",
};

/** Fonds « générés » : compositions graphiques prêtes à l'emploi, sans photo. */
export const FONDS: Record<string, { nom: string; css: string }> = {
  braise: { nom: "Braise", css: "radial-gradient(circle at 30% 20%, #ffb347 0%, #d9531e 45%, #5c1a05 100%)" },
  wok: { nom: "Wok fumant", css: "conic-gradient(from 210deg at 60% 40%, #f7c948, #e0692a, #7a2d10, #f7c948)" },
  nuit: { nom: "Néons Bangkok", css: "linear-gradient(135deg,#2b1055 0%,#7597de 50%,#ff8ba7 100%)" },
  jade: { nom: "Jade", css: "linear-gradient(140deg,#0b5d3b 0%,#43c59e 55%,#d7f9ef 100%)" },
};

/** Version simplifiée des fonds pour l'export image (satori ne gère pas conic-gradient). */
export const FONDS_EXPORT: Record<string, string> = {
  braise: "linear-gradient(140deg,#ffb347 0%,#d9531e 45%,#5c1a05 100%)",
  wok: "linear-gradient(140deg,#f7c948 0%,#e0692a 55%,#7a2d10 100%)",
  nuit: "linear-gradient(135deg,#2b1055 0%,#7597de 50%,#ff8ba7 100%)",
  jade: "linear-gradient(140deg,#0b5d3b 0%,#43c59e 55%,#d7f9ef 100%)",
};

export const EVENEMENT = /festival|open air|événement|evenement/i;

export type Slot = { day: string; service: string; time_range: string | null; note: string | null; status?: string };
export type Service = { label: string; lieu: string; horaires: string; special: boolean };
export type Ligne = { court: string; jourLong: string; services: Service[]; vide: boolean };

const COURT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_LONGS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Construit les 7 lignes de la story à partir des emplacements de la semaine. */
export function lignesSemaine(slots: Slot[], monday: Date): Ligne[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const jour = slots.filter((s) => s.day === key && s.status !== "cancelled");
    const services: Service[] = [];
    for (const nom of ["midi", "soir"] as const) {
      const s = jour.find((x) => x.service === nom);
      if (s)
        services.push({
          label: nom.toUpperCase(),
          lieu: s.note ?? "",
          horaires: s.time_range ?? "",
          special: EVENEMENT.test(s.note ?? ""),
        });
    }
    return { court: COURT[i], jourLong: JOURS_LONGS[i], services, vide: services.length === 0 };
  });
}

/** « Lundi midi Marché de Gif (11h30-14h) · Mardi soir ... » */
export function legendeJours(lignes: Ligne[]): string {
  return lignes
    .filter((l) => !l.vide)
    .map((l) => `${l.jourLong} ${l.services.map((s) => `${s.label.toLowerCase()} ${s.lieu} (${s.horaires})`).join(" et ")}`)
    .join(" · ");
}
