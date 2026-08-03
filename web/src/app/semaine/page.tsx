import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Nav from "../nav";
import { uploadPhoto, deletePhoto } from "./actions";

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

// Fonds « générés » : compositions graphiques prêtes à l'emploi (sans photo)
const FONDS: Record<string, { nom: string; css: string }> = {
  braise: { nom: "Braise", css: "radial-gradient(circle at 30% 20%, #ffb347 0%, #d9531e 45%, #5c1a05 100%)" },
  wok: { nom: "Wok fumant", css: "conic-gradient(from 210deg at 60% 40%, #f7c948, #e0692a, #7a2d10, #f7c948)" },
  nuit: { nom: "Néons Bangkok", css: "linear-gradient(135deg,#2b1055 0%,#7597de 50%,#ff8ba7 100%)" },
  jade: { nom: "Jade", css: "linear-gradient(140deg,#0b5d3b 0%,#43c59e 55%,#d7f9ef 100%)" },
};

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
  searchParams: Promise<{ theme?: string; photo?: string; s?: string; media?: string; fond?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const theme = THEMES[sp.theme ?? "vert"] ?? THEMES.vert;
  const photoKey = sp.photo && PHOTOS[sp.photo] ? sp.photo : "padthai";
  const fond = sp.fond && FONDS[sp.fond] ? sp.fond : null;
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

  // Photos envoyées par l'utilisateur
  const { data: medias } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("kind", "photo")
    .order("created_at", { ascending: false })
    .limit(12);
  const publicUrl = (p: string) => supabase.storage.from("media").getPublicUrl(p).data.publicUrl;
  const mediaPath = sp.media && (medias ?? []).some((m) => m.storage_path === sp.media) ? sp.media : null;

  const lignes = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    const key = iso(d);
    const jour = slots.filter((s) => s.day === key);
    const midi = jour.find((s) => s.service === "midi");
    const soir = jour.find((s) => s.service === "soir");
    const services: { label: string; icone: string; lieu: string; horaires: string; special: boolean }[] = [];
    if (midi)
      services.push({
        label: "MIDI",
        icone: "☀️",
        lieu: midi.note ?? "",
        horaires: midi.time_range ?? "",
        special: /festival|open air|événement|evenement/i.test(midi.note ?? ""),
      });
    if (soir)
      services.push({
        label: "SOIR",
        icone: "🌙",
        lieu: soir.note ?? "",
        horaires: soir.time_range ?? "",
        special: /festival|open air|événement|evenement/i.test(soir.note ?? ""),
      });
    return { court: COURT[i], jourLong: JOURS[i], services, vide: services.length === 0 };
  });

  const legendeJours = lignes
    .filter((l) => !l.vide)
    .map((l) => `${l.jourLong} ${l.services.map((s) => `${s.label.toLowerCase()} ${s.lieu} (${s.horaires})`).join(" et ")}`)
    .join(" · ");

  const periode = `du ${monday.getUTCDate()} au ${sunday.getUTCDate()} ${MOIS[sunday.getUTCMonth()]}`;
  const nbServices = slots.length;

  const lien = (o: { t?: string; p?: string; s?: string; media?: string | null; fond?: string | null }) => {
    const t = o.t ?? sp.theme ?? "vert";
    const p = o.p ?? photoKey;
    const s = o.s ?? (offset === 1 ? "next" : "cur");
    const m = o.media === undefined ? mediaPath : o.media;
    const f = o.fond === undefined ? fond : o.fond;
    let u = `/semaine?theme=${t}&photo=${p}`;
    if (s === "next") u += "&s=next";
    if (m) u += `&media=${encodeURIComponent(m)}`;
    else if (f) u += `&fond=${f}`;
    return u;
  };

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/semaine" />

      <div className="max-w-5xl mx-auto px-4 py-8 grid gap-8 md:grid-cols-[300px_1fr]">
        <div>
          <div
            className="w-full max-w-[300px] mx-auto rounded-2xl overflow-hidden text-white flex flex-col shadow-xl"
            style={{ aspectRatio: "9/16", background: theme.bg }}
          >
            <div
              className="relative flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                height: "24%",
                background: mediaPath ? "#111" : fond ? FONDS[fond].css : theme.photo,
                fontSize: 46,
              }}
            >
              {mediaPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicUrl(mediaPath)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className="absolute top-2 left-2 bg-white text-[#0a3129] font-extrabold rounded-full px-2 py-0.5 z-10" style={{ fontSize: 9 }}>
                CETTE SEMAINE 📍
              </span>
              <span className="absolute top-2 right-2 font-extrabold z-10" style={{ fontSize: 10, textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>CHANA THAÏ</span>
              {!mediaPath && !fond && PHOTOS[photoKey]}
            </div>
            <div className="px-3 pt-2 font-black text-[17px] leading-none">
              On est <span style={{ color: theme.accent }}>où</span> ?
            </div>
            <div className="px-3 text-[9px] opacity-80 mt-1">Vos rendez-vous thaï {periode}</div>
            <div className="flex-1 px-3 py-2 flex flex-col gap-1 min-h-0">
              {lignes.map((l, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 rounded-md px-1.5 py-1 items-start"
                  style={{
                    background: "rgba(255,255,255,.08)",
                    border: l.services.some((s) => s.special) ? `1px solid ${theme.accent}` : "1px solid transparent",
                    opacity: l.vide ? 0.45 : 1,
                  }}
                >
                  <span
                    className="font-extrabold rounded text-center shrink-0 mt-0.5"
                    style={{ background: l.vide ? "rgba(255,255,255,.2)" : theme.accent, color: l.vide ? "#fff" : "#111", fontSize: 7, width: 26, padding: "2px 0" }}
                  >
                    {l.court}
                  </span>
                  <div className="min-w-0 flex-1">
                    {l.vide ? (
                      <>
                        <b className="block leading-tight" style={{ fontSize: 8 }}>Repos du camion</b>
                        <span className="block opacity-70" style={{ fontSize: 6.5 }}>On recharge les woks !</span>
                      </>
                    ) : (
                      l.services.map((s, j) => (
                        <div key={j} className={`flex items-baseline gap-1 ${j > 0 ? "mt-0.5 pt-0.5 border-t border-white/10" : ""}`}>
                          <span
                            className="font-extrabold shrink-0 rounded-sm px-1"
                            style={{
                              fontSize: 5.5,
                              letterSpacing: 0.3,
                              background: s.label === "MIDI" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.28)",
                              color: "#fff",
                            }}
                          >
                            {s.label}
                          </span>
                          <div className="min-w-0">
                            <b className="block leading-tight truncate" style={{ fontSize: 8, color: s.special ? theme.accent : undefined }}>
                              {s.lieu}
                            </b>
                            <span className="block opacity-75" style={{ fontSize: 6.5 }}>{s.horaires}</span>
                          </div>
                        </div>
                      ))
                    )}
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

          {sp.err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {sp.err}</div>
          )}

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Semaine</div>
            <div className="flex gap-2">
              <Link href={lien({ s: "cur" })} className={`text-sm rounded-lg px-3 py-1.5 border ${offset === 0 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}>Cette semaine</Link>
              <Link href={lien({ s: "next" })} className={`text-sm rounded-lg px-3 py-1.5 border ${offset === 1 ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"}`}>Semaine prochaine</Link>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#c8e2da] bg-[#f7fbf9] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#0f6b53] mb-2">Votre photo en haut de la story</div>
            <form action={uploadPhoto} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="theme" value={sp.theme ?? "vert"} />
              <input type="hidden" name="s" value={offset === 1 ? "next" : "cur"} />
              <input
                type="file"
                name="file"
                accept="image/*"
                required
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#0f6b53] file:px-3 file:py-1.5 file:text-white file:text-sm file:font-semibold"
              />
              <button className="text-sm bg-[#12211c] text-white rounded-lg px-3 py-1.5 font-semibold">Envoyer</button>
            </form>
            <p className="text-xs text-gray-500 mt-2">JPG ou PNG, 8 Mo maximum. Depuis le téléphone, l&apos;appareil photo est proposé directement.</p>

            {(medias ?? []).length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {(medias ?? []).map((m) => (
                  <div key={m.storage_path} className="relative">
                    <Link href={lien({ media: m.storage_path, fond: null })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={publicUrl(m.storage_path)}
                        alt=""
                        className={`w-16 h-16 object-cover rounded-lg border-2 ${mediaPath === m.storage_path ? "border-[#0f6b53]" : "border-gray-200"}`}
                      />
                    </Link>
                    <form action={deletePhoto} className="absolute -top-1 -right-1">
                      <input type="hidden" name="path" value={m.storage_path} />
                      <button className="w-5 h-5 rounded-full bg-white border border-gray-300 text-[10px] text-gray-500 hover:text-red-600 leading-none">✕</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Ou un fond généré</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(FONDS).map(([k, f]) => (
                <Link
                  key={k}
                  href={lien({ fond: k, media: null })}
                  title={f.nom}
                  className={`w-14 h-10 rounded-lg border-2 ${fond === k ? "border-[#0f6b53]" : "border-transparent"}`}
                  style={{ background: f.css }}
                />
              ))}
              <Link href={lien({ fond: null, media: null })} className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs text-gray-600 flex items-center">Illustration</Link>
            </div>
          </div>

          {!mediaPath && !fond && (
            <div className="mt-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Illustration</div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(PHOTOS).map(([k, emoji]) => (
                  <Link
                    key={k}
                    href={lien({ p: k })}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 ${photoKey === k ? "border-[#0f6b53] bg-[#e5f2ee]" : "border-gray-200 bg-white"}`}
                  >
                    {emoji}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Couleurs</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(THEMES).map(([k, t]) => (
                <Link
                  key={k}
                  href={lien({ t: k })}
                  title={t.nom}
                  className={`w-9 h-9 rounded-full border-2 ${(sp.theme ?? "vert") === k ? "border-[#12211c]" : "border-transparent"}`}
                  style={{ background: t.bg }}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Légende proposée</div>
            <p className="text-sm text-[#12211c] leading-relaxed">
              📍 Vos rendez-vous thaï {periode} !{" "}
              {legendeJours}. On vous attend au camion 🍜
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
