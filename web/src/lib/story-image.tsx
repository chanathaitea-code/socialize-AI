import { FONDS_EXPORT, type Ligne, type Theme } from "@/lib/story";

export const STORY_L = 1080;
export const STORY_H = 1920;
const L = STORY_L;
const H = STORY_H;

/** Le visuel de la story, partagé par l'export image et les tests de rendu. */
export function storyImageElement({
  theme,
  lignes,
  periode,
  photoUrl,
  fond,
}: {
  theme: Theme;
  lignes: Ligne[];
  periode: string;
  photoUrl: string | null;
  fond: string | null;
}) {
  const bandeau = photoUrl ? "#111" : fond && FONDS_EXPORT[fond] ? FONDS_EXPORT[fond] : theme.photo;
  return (
      <div
        style={{
          width: L,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: theme.bg,
          color: "#fff",
          fontFamily: "Inter",
        }}
      >
        {/* Bandeau photo */}
        <div style={{ height: 470, display: "flex", position: "relative", background: bandeau }}>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" width={L} height={470} style={{ objectFit: "cover" }} />
          )}
          <div
            style={{
              position: "absolute",
              top: 34,
              left: 34,
              display: "flex",
              background: "#fff",
              color: "#0a3129",
              fontWeight: 800,
              fontSize: 30,
              borderRadius: 999,
              padding: "10px 26px",
            }}
          >
            CETTE SEMAINE
          </div>
          <div
            style={{
              position: "absolute",
              top: 38,
              right: 34,
              display: "flex",
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: 1,
            }}
          >
            CHANA THAÏ
          </div>
        </div>

        {/* Titre */}
        <div style={{ display: "flex", gap: 22, padding: "38px 46px 0", fontWeight: 800, fontSize: 76, lineHeight: 1.05 }}>
          <span>Retrouvez notre</span>
          <span style={{ color: theme.accent, paddingLeft: 24 }}>food truck</span>
        </div>
        <div style={{ display: "flex", padding: "14px 46px 0", fontSize: 34, opacity: 0.8 }}>
          Vos rendez-vous thaï {periode}
        </div>

        {/* Jours */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "26px 40px 0", gap: 12 }}>
          {lignes.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                // une journée avec deux services a besoin de plus de hauteur
                flex: l.services.length > 1 ? 1.7 : 1,
                alignItems: "center",
                gap: 22,
                borderRadius: 20,
                padding: "0 22px",
                background: "rgba(255,255,255,0.08)",
                border: l.services.some((s) => s.special) ? `3px solid ${theme.accent}` : "3px solid transparent",
                opacity: l.vide ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 104,
                  height: 58,
                  borderRadius: 12,
                  background: l.vide ? "rgba(255,255,255,0.2)" : theme.accent,
                  color: l.vide ? "#fff" : "#111",
                  fontWeight: 800,
                  fontSize: 30,
                }}
              >
                {l.court}
              </div>

              {l.vide ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontWeight: 800, fontSize: 34 }}>Repos du camion</div>
                  <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>On recharge les woks</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6 }}>
                  {l.services.map((s, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 92,
                          height: 36,
                          borderRadius: 8,
                          fontSize: 21,
                          fontWeight: 800,
                          letterSpacing: 1,
                          background: s.label === "MIDI" ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.32)",
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            fontWeight: 800,
                            fontSize: 36,
                            color: s.special ? theme.accent : "#fff",
                          }}
                        >
                          {s.lieu}
                        </div>
                        <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>{s.horaires}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pied */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "26px 46px 40px",
            fontSize: 30,
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ fontWeight: 800 }}>@chanathaitea2021</span>
            <span style={{ opacity: 0.8 }}>&nbsp;· devis en message privé</span>
          </div>
          <div
            style={{
              display: "flex",
              background: "#fff",
              color: "#0a3129",
              fontWeight: 800,
              borderRadius: 999,
              padding: "10px 26px",
            }}
          >
            foodtruckthai.fr
          </div>
        </div>
      </div>
  );
}
