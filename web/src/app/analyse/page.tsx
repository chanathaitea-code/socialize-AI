import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Nav from "../nav";
import { dechiffrer } from "@/lib/crypto";
import { mesuresPage } from "@/lib/insights";
import { actualiser } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Mesures = {
  vues?: number;
  portee?: number;
  reponses?: number;
  reactions?: number;
  clics?: number;
  indisponible?: string;
};

type Ligne = {
  id: string;
  platform: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
  metrics: Mesures | null;
  metrics_at: string | null;
};

const RESEAU: Record<string, string> = { instagram: "Story Instagram", facebook: "Page Facebook" };

const quand = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function Chiffre({ valeur, libelle }: { valeur?: number; libelle: string }) {
  return (
    <div className="min-w-[74px]">
      <div className="text-lg font-extrabold text-[#12211c] tabular-nums">{valeur ?? "—"}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{libelle}</div>
    </div>
  );
}

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { err, ok } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("publication_log")
    .select("id, platform, caption, media_url, created_at, metrics, metrics_at")
    .eq("status", "published")
    .gte("created_at", depuis)
    .order("created_at", { ascending: false })
    .limit(40);
  const lignes = (data ?? []) as Ligne[];

  const total = (champ: keyof Mesures) =>
    lignes.reduce((s, l) => s + (typeof l.metrics?.[champ] === "number" ? (l.metrics[champ] as number) : 0), 0);

  const vuesStories = total("vues");
  const reactions = total("reactions");
  const derniere = lignes.find((l) => l.metrics_at)?.metrics_at;

  // Vue d'ensemble de la Page : Meta ne donne plus la portée publication par
  // publication, mais la garde au niveau de la Page.
  const { data: compteFb } = await supabase
    .from("social_accounts")
    .select("external_id, encrypted_credentials")
    .eq("platform", "facebook")
    .limit(1)
    .maybeSingle();
  const page = compteFb
    ? await mesuresPage(String(compteFb.external_id), dechiffrer(String(compteFb.encrypted_credentials)))
    : { erreur: "Page non connectée" };

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/analyse" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <h2 className="text-xl font-bold text-[#12211c]">Ce que vos publications ont fait</h2>
            <p className="text-sm text-gray-500 mt-1">
              Trente derniers jours. Les chiffres sont relevés chez Meta et conservés ici, sinon ils disparaîtraient
              avec la story au bout de vingt-quatre heures.
            </p>
          </div>
          <form action={actualiser}>
            <button className="text-sm border border-gray-300 rounded-lg px-4 py-2 font-semibold hover:border-[#0f6b53] hover:text-[#0f6b53]">
              Actualiser
            </button>
          </form>
        </div>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { v: page.vuesPage ?? 0, l: "vues de la Page" },
            { v: page.interactions ?? 0, l: "interactions" },
            { v: page.nouveauxAbonnes ?? 0, l: "nouveaux abonnés" },
          ].map((c) => (
            <div key={c.l} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-3xl font-extrabold text-[#0f6b53] tabular-nums">{c.v}</div>
              <div className="text-xs uppercase tracking-wide text-gray-400 mt-1">{c.l}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Page Facebook, trente derniers jours{page.erreur ? ` · ${page.erreur}` : ""}
          {derniere ? ` · dernier relevé ${quand(derniere)}` : ""}. Vos stories Instagram ont totalisé {vuesStories} vue
          {vuesStories > 1 ? "s" : ""} et vos publications {reactions} réaction{reactions > 1 ? "s" : ""}.
        </p>

        <div className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Publication par publication</div>
          {lignes.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-5">
              Rien de publié sur les trente derniers jours.
            </p>
          ) : (
            <div className="grid gap-2">
              {lignes.map((l) => (
                <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-start flex-wrap">
                  {l.media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.media_url} alt="" className="w-11 h-[74px] object-cover rounded-lg border border-gray-200" />
                  )}
                  <div className="min-w-[150px] flex-1">
                    <div className="font-semibold text-sm text-[#12211c]">{RESEAU[l.platform] ?? l.platform}</div>
                    <div className="text-xs text-gray-400">{quand(l.created_at)}</div>
                    {l.caption && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{l.caption}</p>}
                  </div>
                  <div className="flex gap-4 items-start">
                    {l.platform === "instagram" ? (
                      <>
                        <Chiffre valeur={l.metrics?.vues} libelle="vues" />
                        <Chiffre valeur={l.metrics?.portee} libelle="touchées" />
                      </>
                    ) : (
                      <Chiffre valeur={l.metrics?.reactions} libelle="réactions" />
                    )}
                    {l.platform === "instagram" ? (
                      <Chiffre valeur={l.metrics?.reponses} libelle="réponses" />
                    ) : (
                      <Chiffre valeur={l.metrics?.clics} libelle="clics" />
                    )}
                  </div>
                  {l.metrics?.indisponible && (
                    <p className="text-[11px] text-amber-700 w-full">{l.metrics.indisponible}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Une story Instagram ne rend ses chiffres que pendant sa durée de vie, d&apos;où le relevé automatique toutes les
          cinq minutes. Côté Facebook, Meta a supprimé la portée publication par publication : elle n&apos;existe plus
          qu&apos;au niveau de la Page, d&apos;où les trois compteurs du haut.
        </p>
      </div>
    </main>
  );
}
