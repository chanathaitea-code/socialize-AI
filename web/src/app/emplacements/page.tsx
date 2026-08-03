import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { JOURS, clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import Nav from "../nav";
import { addSlot, annulerJournee, deleteSlot, copyPreviousWeek, retablirJournee } from "./actions";

export const dynamic = "force-dynamic";

type Slot = {
  id: string;
  day: string;
  service: string;
  time_range: string | null;
  note: string | null;
  status: string;
};

export default async function EmplacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string; w?: string }>;
}) {
  const { err, ok, w: wRaw } = await searchParams;
  const w = clampWeek(wRaw);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Première connexion : crée organisation + marque + réglages
  await supabase.rpc("bootstrap_account", { p_name: "Chana Thaï" });

  const monday = mondayOf(w);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const { data: slots } = await supabase
    .from("location_schedule")
    .select("id, day, service, time_range, note, status")
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day")
    .order("service");

  // Semaine précédente : sert au bouton « reprendre la semaine précédente »
  const lundiPrec = mondayOf(w - 1);
  const dimanchePrec = new Date(lundiPrec);
  dimanchePrec.setUTCDate(dimanchePrec.getUTCDate() + 6);
  const { count: nbPrec } = await supabase
    .from("location_schedule")
    .select("id", { count: "exact", head: true })
    .gte("day", iso(lundiPrec))
    .lte("day", iso(dimanchePrec));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return { label: JOURS[i], date: iso(d), num: d.getUTCDate() };
  });

  const byDay = new Map<string, Slot[]>();
  (slots ?? []).forEach((s) => {
    const list = byDay.get(s.day) ?? [];
    list.push(s as Slot);
    byDay.set(s.day, list);
  });

  const vide = (slots ?? []).length === 0;
  const lienSemaine = (n: number) => (n === 0 ? "/emplacements" : `/emplacements?w=${n}`);
  const intitule =
    w === 0 ? "Cette semaine" : w === 1 ? "Semaine prochaine" : w === -1 ? "Semaine dernière" : null;

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/emplacements" />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={lienSemaine(w - 1)}
              aria-label="Semaine précédente"
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:border-[#0f6b53] hover:text-[#0f6b53]"
            >
              ‹
            </Link>
            <h2 className="text-xl font-bold text-[#12211c]">Semaine {libellePeriode(monday)}</h2>
            <Link
              href={lienSemaine(w + 1)}
              aria-label="Semaine suivante"
              className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 flex items-center justify-center hover:border-[#0f6b53] hover:text-[#0f6b53]"
            >
              ›
            </Link>
            {intitule && (
              <span className="text-[11px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 bg-[#e5f2ee] text-[#0f6b53]">
                {intitule}
              </span>
            )}
            {w !== 0 && (
              <Link href="/emplacements" className="text-sm text-gray-500 hover:text-[#0f6b53] underline">
                revenir à cette semaine
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Chaque emplacement enregistré ici pilotera les Stories « on est là », la fiche Google et les réponses « vous êtes où ? ».
          </p>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}
        {ok && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ {ok}
          </div>
        )}

        {vide && (nbPrec ?? 0) > 0 && (
          <form
            action={copyPreviousWeek}
            className="mb-5 rounded-xl border border-[#c8e2da] bg-[#f7fbf9] px-4 py-3 flex items-center gap-3 flex-wrap"
          >
            <input type="hidden" name="w" value={w} />
            <div className="text-sm text-[#12211c] flex-1 min-w-[220px]">
              Cette semaine est vide, alors que la précédente compte {nbPrec} service{(nbPrec ?? 0) > 1 ? "s" : ""}.
              <span className="text-gray-500"> Vos emplacements sont récurrents ? Reprenez-les d&apos;un clic, vous ajusterez ensuite.</span>
            </div>
            <button className="text-sm bg-[#0f6b53] text-white rounded-lg px-4 py-2 font-semibold hover:opacity-90">
              ⟳ Reprendre la semaine précédente
            </button>
          </form>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          {days.map((day) => {
            const daySlots = byDay.get(day.date) ?? [];
            return (
              <div key={day.date} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#12211c]">
                    {day.label} <span className="text-gray-400 font-normal">{day.num}</span>
                    {daySlots.length > 0 && daySlots.every((s) => s.status === "cancelled") && (
                      <span className="ml-2 text-[10px] font-bold uppercase rounded px-2 py-0.5 bg-red-100 text-red-700">
                        journée annulée
                      </span>
                    )}
                  </span>
                  {daySlots.length === 0 ? (
                    <span className="text-xs text-gray-400">jour sans service</span>
                  ) : daySlots.every((s) => s.status === "cancelled") ? (
                    <form action={retablirJournee}>
                      <input type="hidden" name="day" value={day.date} />
                      <input type="hidden" name="w" value={w} />
                      <button className="text-xs text-gray-500 hover:text-[#0f6b53] underline">
                        finalement on y va
                      </button>
                    </form>
                  ) : (
                    <form action={annulerJournee}>
                      <input type="hidden" name="day" value={day.date} />
                      <input type="hidden" name="w" value={w} />
                      <button className="text-xs text-gray-400 hover:text-red-600 underline">
                        journée annulée
                      </button>
                    </form>
                  )}
                </div>

                {daySlots.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-t border-gray-100">
                    <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${s.service === "midi" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                      {s.service}
                    </span>
                    <span className={`text-sm font-medium ${s.status === "cancelled" ? "text-gray-400 line-through" : "text-[#12211c]"}`}>
                      {s.note}
                    </span>
                    <span className="text-xs text-gray-500">{s.time_range}</span>
                    <form action={deleteSlot} className="ml-auto">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="w" value={w} />
                      <button className="text-xs text-gray-400 hover:text-red-600">Supprimer</button>
                    </form>
                  </div>
                ))}

                <form action={addSlot} className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 mt-2">
                  <input type="hidden" name="day" value={day.date} />
                  <input type="hidden" name="w" value={w} />
                  <select name="service" className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
                    <option value="midi">Midi</option>
                    <option value="soir">Soir</option>
                  </select>
                  <input
                    name="lieu"
                    placeholder="Lieu (ex : Marché de Gif)"
                    className="flex-1 min-w-[140px] text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  />
                  <input
                    name="horaires"
                    placeholder="11h30-14h"
                    className="w-24 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  />
                  <button className="text-sm bg-[#0f6b53] text-white rounded-lg px-3 py-1.5 font-semibold hover:opacity-90">
                    Ajouter
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Données enregistrées en temps réel dans votre base sécurisée (Supabase, Paris). Les emplacements restent
          consultables semaine par semaine, rien n&apos;est effacé au changement de semaine.
        </p>
      </div>
    </main>
  );
}
