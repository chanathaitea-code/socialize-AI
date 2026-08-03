import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { chargerThemes } from "@/lib/design";
import { versSaisieParis } from "@/lib/semaine";
import { GABARITS, type Gabarit } from "@/lib/gabarits";
import Nav from "../nav";
import Formulaire from "./formulaire";
import { publierGabarit } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORDRE: Gabarit[] = ["plat", "avis", "coulisses", "rebours"];

/** Aujourd'hui à Paris, au format AAAA-MM-JJ. */
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    g?: string;
    err?: string;
    ok?: string;
    titre?: string;
    sous?: string;
    prix?: string;
    texte?: string;
    auteur?: string;
    lieu?: string;
  }>;
}) {
  const { g, err, ok, ...pre } = await searchParams;
  const gabarit = (ORDRE.includes(g as Gabarit) ? g : "plat") as Gabarit;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: medias }, { data: produits }, { data: slots }] = await Promise.all([
    supabase
      .from("media_assets")
      .select("storage_path")
      .eq("kind", "photo")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("products").select("name, price_cents, out_of_stock").eq("active", true),
    supabase
      .from("location_schedule")
      .select("service, time_range, note, status")
      .eq("day", aujourdhuiParis())
      .neq("status", "cancelled")
      .order("service"),
  ]);

  const photos = (medias ?? []).map((m) => ({
    chemin: m.storage_path as string,
    url: supabase.storage.from("media").getPublicUrl(m.storage_path as string).data.publicUrl,
  }));

  const plats = (produits ?? [])
    .filter((p) => !p.out_of_stock)
    .map((p) => ({
      nom: p.name as string,
      prix: p.price_cents ? `${(p.price_cents / 100).toFixed(2).replace(".", ",").replace(",00", "")} €` : "",
    }));

  const premier = (slots ?? [])[0];
  const lieuDuJour = premier ? `${premier.note ?? ""}${premier.time_range ? ` · ${premier.time_range}` : ""}` : "";

  const themes = Object.entries(await chargerThemes(supabase)).map(([cle, t]) => ({ cle, nom: t.nom }));
  const defautQuand = versSaisieParis(new Date(Date.now() + 60 * 60_000));

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/stories" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[#12211c]">Stories</h2>
        <p className="text-sm text-gray-500 mt-1">
          Vos emplacements ne sont pas votre seul sujet. Quatre modèles pour parler d&apos;autre chose, aux couleurs de
          la marque, prêts à partir en une minute.
        </p>

        <div className="flex gap-2 mt-4 flex-wrap text-sm">
          {ORDRE.map((cle) => (
            <Link
              key={cle}
              href={`/stories?g=${cle}`}
              className={`rounded-lg px-3 py-1.5 border ${
                cle === gabarit ? "bg-[#0f6b53] text-white border-[#0f6b53]" : "bg-white border-gray-300 text-gray-600"
              }`}
            >
              {GABARITS[cle].nom}
            </Link>
          ))}
          <Link
            href="/semaine"
            className="rounded-lg px-3 py-1.5 border bg-white border-gray-300 text-gray-400 hover:text-[#0f6b53]"
          >
            Semaine et journée →
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-3">{GABARITS[gabarit].quoi}</p>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ {ok}
          </div>
        )}

        <Formulaire
          key={`${gabarit}-${pre.titre ?? ""}${pre.texte ?? ""}`}
          gabarit={gabarit}
          initial={pre}
          photos={photos}
          plats={plats}
          lieuDuJour={lieuDuJour}
          themes={themes}
          defautQuand={defautQuand}
          publier={publierGabarit}
        />

        <p className="text-xs text-gray-400 mt-6">
          Les prix proposés viennent de votre carte : si vous en tapez un autre, c&apos;est celui-là qui sera publié.
          Rien ne part sans que vous cliquiez.
        </p>
      </div>
    </main>
  );
}
