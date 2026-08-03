/**
 * Gabarits de stories autres que les emplacements.
 *
 * Un food truck qui ne parle que de ses adresses lasse vite : ces quatre
 * modèles couvrent le reste du quotidien — le plat qu'on met en avant, ce que
 * les clients en disent, ce qui se passe derrière le comptoir, et l'urgence des
 * jours de service. Tous rendus en 1080×1920 par `rendreElement`.
 */
import type { Theme } from "./story";
import { STORY_H, STORY_L } from "./story-image";

const L = STORY_L;
const H = STORY_H;

export type Gabarit = "plat" | "avis" | "coulisses" | "rebours";

export const GABARITS: Record<
  Gabarit,
  { nom: string; quoi: string; champs: string[]; conseil: string }
> = {
  plat: {
    nom: "Plat à l'honneur",
    quoi: "Une photo, le nom du plat, le prix de votre carte.",
    champs: ["titre", "prix", "sous", "photo"],
    conseil: "Photographiez la barquette de trois quarts, à hauteur de comptoir, sans flash.",
  },
  avis: {
    nom: "Avis client",
    quoi: "Un avis en grand, cinq étoiles, aux couleurs de la marque.",
    champs: ["texte", "auteur"],
    conseil: "Recopiez l'avis mot pour mot : les clients reconnaissent une phrase réécrite.",
  },
  coulisses: {
    nom: "Coulisses",
    quoi: "Le wok, la préparation, l'équipe : ce que personne ne voit.",
    champs: ["titre", "sous", "photo"],
    conseil: "Filmez ou photographiez pendant le coup de feu, le mouvement fait tout.",
  },
  rebours: {
    nom: "Compte à rebours",
    quoi: "« On ouvre dans une heure », « plus que quelques portions ».",
    champs: ["titre", "sous", "lieu", "photo"],
    conseil: "À poster une heure avant le service, quand les gens décident où déjeuner.",
  },
};

export type ChampsGabarit = {
  titre?: string;
  sous?: string;
  prix?: string;
  texte?: string;
  auteur?: string;
  lieu?: string;
  photoUrl?: string | null;
};

const MARQUE = "CHANA THAÏ";
const COMPTE = "@chanathaitea2021";
const SITE = "foodtruckthai.fr";

/** Le bas de tous les visuels : la signature, toujours au même endroit. */
function pied() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "30px 56px 46px",
        fontSize: 32,
      }}
    >
      <div style={{ display: "flex", fontWeight: 800 }}>{COMPTE}</div>
      <div
        style={{
          display: "flex",
          background: "#fff",
          color: "#0a3129",
          fontWeight: 800,
          borderRadius: 999,
          padding: "12px 28px",
        }}
      >
        {SITE}
      </div>
    </div>
  );
}

/** L'étiquette ronde en haut à gauche, avec le nom de la marque en face. */
function entete(theme: Theme, mot: string) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "44px 44px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          background: theme.accent,
          color: "#111",
          fontWeight: 800,
          fontSize: 32,
          borderRadius: 999,
          padding: "12px 30px",
        }}
      >
        {mot}
      </div>
      <div style={{ display: "flex", fontWeight: 800, fontSize: 32, color: "#fff" }}>{MARQUE}</div>
    </div>
  );
}

const cadre = (theme: Theme) => ({
  width: L,
  height: H,
  display: "flex" as const,
  flexDirection: "column" as const,
  background: theme.bg,
  color: "#fff",
  fontFamily: "Inter",
});

/** Plat à l'honneur : la photo occupe le haut, le prix saute aux yeux. */
function platElement(theme: Theme, c: ChampsGabarit) {
  return (
    <div style={cadre(theme)}>
      <div style={{ height: 1080, display: "flex", position: "relative", background: c.photoUrl ? "#111" : theme.photo }}>
        {c.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photoUrl} alt="" width={L} height={1080} style={{ objectFit: "cover" }} />
        )}
        {/* Un voile sombre en haut, sinon le nom de la marque disparaît sur une photo claire */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: L,
            height: 240,
            background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: L }}>{entete(theme, "À LA CARTE")}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "54px 56px 0" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 96, lineHeight: 1.05 }}>{c.titre ?? "Notre plat du jour"}</div>
        {c.prix && (
          <div style={{ display: "flex", marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                background: theme.accent,
                color: "#111",
                fontWeight: 800,
                fontSize: 58,
                borderRadius: 999,
                padding: "16px 44px",
              }}
            >
              {c.prix}
            </div>
          </div>
        )}
        {c.sous && (
          <div style={{ display: "flex", fontSize: 40, opacity: 0.8, marginTop: 30, lineHeight: 1.35 }}>{c.sous}</div>
        )}
      </div>

      {pied()}
    </div>
  );
}

/** Avis client : pas de photo, le texte est le visuel. */
function avisElement(theme: Theme, c: ChampsGabarit) {
  const texte = c.texte ?? "";
  // Un avis court mérite d'être énorme, un avis long doit rester lisible.
  const taille = texte.length > 260 ? 46 : texte.length > 150 ? 56 : 68;
  return (
    <div style={cadre(theme)}>
      {entete(theme, "ILS EN PARLENT")}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "70px 62px 0" }}>
        <div style={{ display: "flex", fontSize: 72, letterSpacing: 6, color: theme.accent }}>★★★★★</div>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 140, lineHeight: 0.7, opacity: 0.25, marginTop: 20 }}>
          «
        </div>
        <div style={{ display: "flex", fontSize: taille, lineHeight: 1.35, marginTop: 10 }}>{texte}</div>
        {c.auteur && (
          <div style={{ display: "flex", fontSize: 38, opacity: 0.7, marginTop: 44 }}>— {c.auteur}</div>
        )}
      </div>

      <div style={{ display: "flex", padding: "0 62px 20px" }}>
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.10)",
            borderRadius: 24,
            padding: "26px 34px",
            fontSize: 34,
            lineHeight: 1.3,
          }}
        >
          Vous aussi, laissez-nous un avis Google : ça nous aide plus que tout.
        </div>
      </div>

      {pied()}
    </div>
  );
}

/** Coulisses : la photo prend tout, le texte est posé dessus. */
function coulissesElement(theme: Theme, c: ChampsGabarit) {
  return (
    <div style={{ ...cadre(theme), position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, display: "flex", width: L, height: H, background: c.photoUrl ? "#111" : theme.photo }}>
        {c.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photoUrl} alt="" width={L} height={H} style={{ objectFit: "cover" }} />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          width: L,
          height: H,
          background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 38%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", width: L, height: H }}>
        {entete(theme, "COULISSES")}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "0 56px 10px" }}>
          <div style={{ display: "flex", fontWeight: 800, fontSize: 92, lineHeight: 1.05 }}>
            {c.titre ?? "Dans le camion"}
          </div>
          {c.sous && (
            <div style={{ display: "flex", fontSize: 40, opacity: 0.85, marginTop: 22, lineHeight: 1.35 }}>{c.sous}</div>
          )}
        </div>
        {pied()}
      </div>
    </div>
  );
}

/** Compte à rebours : lisible d'un coup d'œil, à une heure du service. */
function reboursElement(theme: Theme, c: ChampsGabarit) {
  return (
    <div style={cadre(theme)}>
      {entete(theme, "AUJOURD’HUI")}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "80px 56px 0" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 130, lineHeight: 1, color: theme.accent }}>
          {c.titre ?? "DANS 1H"}
        </div>
        {c.sous && (
          <div style={{ display: "flex", fontWeight: 800, fontSize: 62, marginTop: 34, lineHeight: 1.15 }}>{c.sous}</div>
        )}
        {c.lieu && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.10)",
              borderRadius: 28,
              padding: "32px 36px",
              marginTop: 46,
            }}
          >
            <div style={{ display: "flex", fontSize: 30, opacity: 0.7, letterSpacing: 3 }}>ON EST LÀ</div>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 56, marginTop: 12, lineHeight: 1.15 }}>{c.lieu}</div>
          </div>
        )}
      </div>

      {c.photoUrl && (
        <div style={{ height: 560, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.photoUrl} alt="" width={L} height={560} style={{ objectFit: "cover" }} />
        </div>
      )}

      {pied()}
    </div>
  );
}

/** Point d'entrée unique : un gabarit, un thème, des champs, un visuel. */
export function gabaritElement(gabarit: Gabarit, theme: Theme, champs: ChampsGabarit) {
  switch (gabarit) {
    case "avis":
      return avisElement(theme, champs);
    case "coulisses":
      return coulissesElement(theme, champs);
    case "rebours":
      return reboursElement(theme, champs);
    default:
      return platElement(theme, champs);
  }
}

/** La légende par défaut proposée sous le visuel, selon le gabarit. */
export function legendeGabarit(gabarit: Gabarit, c: ChampsGabarit): string {
  switch (gabarit) {
    case "avis":
      return `${c.texte ? `« ${c.texte} »` : "Merci pour vos mots"}${c.auteur ? `\n— ${c.auteur}` : ""}\n\nMerci 🙏 Votre avis Google nous aide énormément.`;
    case "coulisses":
      return `${c.titre ?? "Dans le camion"}${c.sous ? `\n\n${c.sous}` : ""}`;
    case "rebours":
      return `${c.titre ?? "C'est bientôt"}${c.sous ? ` · ${c.sous}` : ""}${c.lieu ? `\n📍 ${c.lieu}` : ""}\n\nOn vous attend 🍜`;
    default:
      return `${c.titre ?? "Notre plat du jour"}${c.prix ? ` · ${c.prix}` : ""}${c.sous ? `\n\n${c.sous}` : ""}`;
  }
}
