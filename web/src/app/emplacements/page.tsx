import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { addSlot, deleteSlot, signOut } from "./actions";

export const dynamic = "force-dynamic";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function mondayOfCurrentWeek(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Première connexion : crée organisation + marque + réglages
  await supabase.rpc("bootstrap_account", { p_name: "Chana Thaï" });

  const monday = mondayOfCurrentWeek();
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const { data: slots } = await supabase
    .from("location_schedule")
    .select("id, day, service, time_range, note, status")
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day")
    .order("service");

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

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <h1 className="font-extrabold text-[#12211c]">
          Social<span className="text-[#0f6b53]">Flow</span> AI
        </h1>
        <nav className="flex gap-3 text-sm">
          <span className="font-semibold text-[#0f6b53]">Emplacements</span>
          <a href="/semaine" className="text-gray-500 hover:text-[#0f6b53]">Story de la semaine</a>
        </nav>
        <form action={signOut} className="ml-auto">
          <button className="text-sm text-gray-500 hover:text-red-600">Déconnexion</button>
        </form>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#12211c]">Semaine du {days[0].num} au {days[6].num}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Chaque emplacement enregistré ici pilotera les Stories « on est là », la fiche Google et les réponses « vous êtes où ? ».
          </p>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
          {days.map((day) => {
            const daySlots = byDay.get(day.date) ?? [];
            return (
              <div key={day.date} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-[#12211c]">
                    {day.label} <span className="text-gray-400 font-normal">{day.num}</span>
                  </span>
                  {daySlots.length === 0 && <span className="text-xs text-gray-400">jour sans service</span>}
                </div>

                {daySlots.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-t border-gray-100">
                    <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${s.service === "midi" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                      {s.service}
                    </span>
                    <span className="text-sm font-medium text-[#12211c]">{s.note}</span>
                    <span className="text-xs text-gray-500">{s.time_range}</span>
                    <form action={deleteSlot} className="ml-auto">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-gray-400 hover:text-red-600">Supprimer</button>
                    </form>
                  </div>
                ))}

                <form action={addSlot} className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 mt-2">
                  <input type="hidden" name="day" value={day.date} />
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
          Données enregistrées en temps réel dans votre base sécurisée (Supabase, Paris). Phase 1, lot 1.
        </p>
      </div>
    </main>
  );
}
