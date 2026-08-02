import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const COURT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const THEMES: Record<string, { bg: string; accent: string; photo: string; nom: string }> = {
  vert: { nom: "Vert Bangkok", bg: "linear-gradient(175deg,#0a3129,#0d4a3a 45%,#0a2e26)", accent: "#f3c04b", photo: "linear-gradient(160deg,#d9a13b,#c8501f 70%)" },
  nuit: { nom: "Nuit dorée", bg: "linear-gradient(175deg,#0e1520,#1d2c42 50%,#0b111b)", accent: "#e2b25a", photo: "linear-gradient(160deg,#c8a24a,#7a5716 80%)" },
  rose: { nom: "Rose bubble tea", bg: "linear-gradient(175deg,#2a1233,#6e2954 55%,#22101f)", accent: "#ff9ec4", photo: "linear-gradient(160deg,#e0527f,#7b2d5e 80%)" },
  piment: { nom: "Piment doux", bg: "linear-gradient(175deg,#4a1206,#8a2f10 55%,#3a0e05)", accent: "#ffcf7a", photo: "linear-gradient(160deg,#f3b13c,#c8501f 75%)" },
};
const PHOTOS: Record<string, string> = { padthai: "🍜", crousty: "🍗", bubble: "🧋", cheffe: "👩‍🍳", camion: "🚚", poke: "🥡" };

function mondayOf(offsetWeeks: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offsetWeeks * 7);
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Slot = { day: string; service: string; time_range: string | null; note: string | null };

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; photo?: string; s?: string }>;
}) {
  const sp = await searchParams;
  const theme = THEMES[sp.theme ?? "vert"] ?? THEMES.vert;
  const photoKey = sp.photo && PHOTOS[sp.photo] ? sp.photo : "padthai";
  const offset = sp.s === "next" ? 1 : 0;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monday = mondayOf(offset);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const { data } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day")
    .order("service");
  const slots = (data ?? []) as Slot[];

  const lignes = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const key = iso(d);
    const jour = slots.filter((s) => s.day === key);
    const midi = jour.find((s) => s.service === "midi");
    const soir = jour.find((s) => s.service === "soir");
    let titre = "Repos du camion";
    let detail = "On recharge les woks, à demain !";
    if (midi && soir) {
      titre = `${midi.note} · ${soir.note}`;
      detail = `${midi.time_range} puis ${soir.time_range}`;
    } else if (midi || soir) {
      const x = (midi ?? soir)!;
      titre = x.note ?? "";
      detail = x.time_range ?? "";
    }
    const special = /festival|open air|événement|evenement/i.test(titre);
    return { court: COURT[i], titre, detail, vide: !midi && !soir, special };
  });

  const periode = `du ${monday.getUTCDate()} au ${sunday.getUTCDate()} ${MOIS[sunday.getUTCMonth()]}`;
  const nbServices = slots.length;

  const lien = (t: string, p: string, s: string) => `/semaine?theme=${t}&photo=${p}${s === "next" ? "&s=next" : ""}`;

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="font-extrabold text-[#12211c]">
          Social<span className="text-[#0f6b53]">Flow</span> AI
        </h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/emplacements" className="text-gray-500 hover:text-[#0f6b53]">Emplacements</Link>
          <span className="font-semibold text-[#0f6b53]">Story de la semaine</span>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 grid gap-8 md:grid-cols-[300px_1fr]">
        <div>
          <div
            className="w-full max-w-[300px] mx-auto rounded-2xl overflow-hidden text-white flex flex-col shadow-xl"
            style={{ aspectRatio: "9/16", background: theme.bg }}
          >
            <div className="relative flex items-center justify-center shrink-0" style={{ height: "24%", background: theme.photo, fontSize: 46 }}>
              <span className="absolute top-2 left-2 bg-white text-[#0a3129] font-extrabold rounded-full px-2 py-0.5" style={{ fontSize: 9 }}>
                CETTE SEMAINE 📍
              </span>
              <span className="absolute top-2 right-2 font-extrabold" style={{ fontSize: 10 }}>CHANA THAÏ</span>
              {PHOTOS[photoKey]}
            </div>
            <div className="px-3 pt-2 font-black text-[17px] leading-none">
              On est <span style={{ color: theme.accent }}>où</span> ?
            </div>
            <div className="px-3 text-[9px] opacity-80 mt-1">Vos rendez-vous thaï {periode}</div>
            <div className="flex-1 px-3 py-2 flex flex-col gap-1 min-h-0">
              {lignes.map((l, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 items-center rounded-md px-1.5 py-1"
                  style={{
                    background: l.special ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.08)",
                    border: l.special ? `1px solid ${theme.accent}` : "1px solid transparent",
                    opacity: l.vide ? 0.5 : 1,
                  }}
                >
                  <span
                    className="font-extrabold rounded text-center shrink-0"
                    style={{ background: l.vide ? "rgba(255,255,255,.2)" : theme.accent, color: l.vide ? "#fff" : "#111", fontSize: 7, width: 26, padding: "2px 0" }}
                  >
                    {l.court}
                  </span>
                  <div className="min-w-0">
                    <b className="block leading-tight truncate" style={{ fontSize: 8.5, color: l.special ? theme.accent : undefined }}>
                      {l.titre}
                    </b>
                    <span className="block opacity-75 truncate" style={{ fontSize: 7 }}>{l.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-white/15 flex items-center justify-between" style={{ fontSize: 8 }}>
              <span><b>@chanathai</b> · devis en DM</span>
              <span className="bg-white text-[#0a3129] font-extrabold rounded-full px-2 py-0.5">foodtruckthai.fr</span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">Aperçu · format 1080×1920</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#12211c]">Story de la semaine, générée automatiquement</h2>
          <p className="text-sm text-gray-500 mt-1">
            Construite depuis vos {nbServices} service{nbServices > 1 ? "s" : ""} enregistré{nbServices > 1 ? "s" : ""}. Modifiez un emplacement, la story se met à jour toute seule.
          </p>

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Semaine</div>
            <div className="flex gap-2">
              <Link href={lien(sp.theme ?? "vert", photoKey, "cur")} className={`text-sm rounded-lg px-3 py-1.5 border ${offset === 0 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}>Cette semaine</Link>
              <Link href={lien(sp.theme ?? "vert", photoKey, "next")} className={`text-sm rounded-lg px-3 py-1.5 border ${offset === 1 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}>Semaine prochaine</Link>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Couleurs</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(THEMES).map(([k, t]) => (
                <Link
                  key={k}
                  href={lien(k, photoKey, offset === 1 ? "next" : "cur")}
                  title={t.nom}
                  className={`w-9 h-9 rounded-full border-2 ${(sp.theme ?? "vert") === k ? "border-[#12211c]" : "border-transparent"}`}
                  style={{ background: t.bg }}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Photo de la semaine</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PHOTOS).map(([k, emoji]) => (
                <Link
                  key={k}
                  href={lien(sp.theme ?? "vert", k, offset === 1 ? "next" : "cur")}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 ${photoKey === k ? "border-[#0f6b53] bg-[#e5f2ee]" : "border-gray-200 bg-white"}`}
                >
                  {emoji}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Légende proposée</div>
            <p className="text-sm text-[#12211c] leading-relaxed">
              📍 Vos rendez-vous thaï {periode} !{" "}
              {lignes.filter((l) => !l.vide).map((l) => `${l.court} : ${l.titre}`).join(" · ")}. On vous attend au camion 🍜
              <br />
              <span className="text-gray-400 text-xs">#foodtruck #thai #chanathai #essonne #yvelines</span>
            </p>
          </div>

          <p className="text-xs text-gray-400 mt-5">
            Prochaine étape du développement : publication automatique de cette story chaque dimanche 18h sur Instagram et Facebook.
          </p>
        </div>
      </div>
    </main>
  );
}
