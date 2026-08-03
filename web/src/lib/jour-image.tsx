import type { Theme } from "./story";
import { STORY_H, STORY_L } from "./story-image";

export type ServiceJour = { label: string; lieu: string; horaires: string };

/**
 * La story du jour : plus grosse, plus lisible en une seconde, faite pour être
 * vue le matin par quelqu'un qui se demande simplement « ils sont où à midi ».
 */
export function jourImageElement({
  theme,
  jourLong,
  dateCourte,
  services,
  photoUrl,
  meteo,
}: {
  theme: Theme;
  jourLong: string;
  dateCourte: string;
  services: ServiceJour[];
  photoUrl: string | null;
  meteo?: string;
}) {
  return (
    <div
      style={{
        width: STORY_L,
        height: STORY_H,
        display: "flex",
        flexDirection: "column",
        background: theme.bg,
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      <div style={{ height: 700, display: "flex", position: "relative", background: photoUrl ? "#111" : theme.photo }}>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" width={STORY_L} height={700} style={{ objectFit: "cover" }} />
        )}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            display: "flex",
            background: theme.accent,
            color: "#111",
            fontWeight: 800,
            fontSize: 34,
            borderRadius: 999,
            padding: "12px 30px",
          }}
        >
          AUJOURD&apos;HUI
        </div>
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 40,
            display: "flex",
            fontWeight: 800,
            fontSize: 34,
          }}
        >
          CHANA THAÏ
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "48px 56px 0" }}>
        <div style={{ display: "flex", fontWeight: 800, fontSize: 82, lineHeight: 1 }}>{jourLong}</div>
        <div style={{ display: "flex", fontSize: 38, opacity: 0.75, marginTop: 10 }}>
          {dateCourte}
          {meteo ? ` · ${meteo}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24, padding: "40px 56px 0" }}>
        {services.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 60 }}>Le camion se repose</div>
            <div style={{ display: "flex", fontSize: 36, opacity: 0.75, marginTop: 12 }}>
              On recharge les woks, à très vite
            </div>
          </div>
        ) : (
          services.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.09)",
                borderRadius: 28,
                padding: "30px 34px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: theme.accent,
                    color: "#111",
                    fontWeight: 800,
                    fontSize: 26,
                    borderRadius: 10,
                    padding: "8px 18px",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ display: "flex", fontSize: 32, opacity: 0.8 }}>{s.horaires}</div>
              </div>
              <div style={{ display: "flex", fontWeight: 800, fontSize: 52, marginTop: 14, lineHeight: 1.1 }}>
                {s.lieu}
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "30px 56px 46px",
          fontSize: 32,
        }}
      >
        <div style={{ display: "flex" }}>
          <span style={{ fontWeight: 800 }}>@chanathaitea2021</span>
        </div>
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
          foodtruckthai.fr
        </div>
      </div>
    </div>
  );
}
