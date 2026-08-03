import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { ajouterProduit, analyser, retirerProduit, terminer, validerProfil } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHAMPS: { cle: string; titre: string; aide: string; lignes?: number }[] = [
  { cle: "activite", titre: "Votre activité", aide: "Ce que vous faites, en une phrase.", lignes: 2 },
  { cle: "positionnement", titre: "Ce qui vous distingue", aide: "Pourquoi on vient chez vous plutôt qu'ailleurs.", lignes: 3 },
  { cle: "cible", titre: "Vos clients", aide: "À qui vous vous adressez." , lignes: 2 },
  { cle: "zone", titre: "Votre zone", aide: "Où vous intervenez.", lignes: 1 },
  { cle: "ton", titre: "Votre ton", aide: "La façon de vous exprimer : chaleureux, direct, technique…", lignes: 2 },
  { cle: "objectifs", titre: "Vos objectifs", aide: "Ce que la communication doit vous rapporter.", lignes: 2 },
  { cle: "interdits", titre: "Ce qu'il ne faut jamais écrire", aide: "Mots et promesses à bannir. Ils seront signalés avant chaque publication.", lignes: 2 },
];

export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ etape?: string; err?: string }>;
}) {
  const { etape: e, err } = await searchParams;
  const etape = Math.max(1, Math.min(3, parseInt(e ?? "1", 10) || 1));

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, handle, website, city, brand_brief")
    .limit(1);
  const brand = brands?.[0];
  const brief = ((brand?.brand_brief ?? {}) as Record<string, string>) ?? {};

  const { data: produits } = await supabase.from("products").select("id, name, price_cents").order("name");
  const { data: comptes } = await supabase.from("social_accounts").select("platform, status");

  const euros = (c: number | null) =>
    c ? `${(c / 100).toFixed(2).replace(".", ",").replace(",00", "")} €` : "—";

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <header className="bg-[#0b1512] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="font-extrabold">
            Social<span className="text-[#3ecf9a]">Flow</span> AI
          </div>
          <div className="text-[11px] text-white/40">Community manager autonome</div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex gap-2 text-xs mb-6">
          {["Votre entreprise", "Votre profil", "Vos comptes"].map((t, i) => (
            <div
              key={t}
              className={`flex-1 rounded-lg px-3 py-2 border ${
                i + 1 === etape
                  ? "bg-[#0f6b53] text-white border-[#0f6b53] font-semibold"
                  : i + 1 < etape
                    ? "bg-[#e5f2ee] text-[#0f6b53] border-[#c8e2da]"
                    : "bg-white text-gray-400 border-gray-200"
              }`}
            >
              {i + 1}. {t}
            </div>
          ))}
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}

        {etape === 1 && (
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h1 className="text-xl font-bold text-[#12211c]">Bienvenue. Commençons par votre entreprise.</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Donnez-nous son nom et l&apos;adresse de votre site. Nous le lisons et nous préparons votre profil
              complet : activité, positionnement, clients, ton, zone, et même votre carte avec les prix. Vous
              n&apos;aurez plus qu&apos;à corriger ce qui ne va pas.
            </p>

            <form action={analyser} className="mt-6 grid gap-4">
              <label className="text-sm">
                <span className="block font-semibold text-[#12211c] mb-1">Nom de l&apos;entreprise</span>
                <input
                  name="nom"
                  defaultValue={brand?.name === "Ma marque" ? "" : (brand?.name as string)}
                  placeholder="Chana Thaï"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="block font-semibold text-[#12211c] mb-1">Adresse de votre site</span>
                <input
                  name="site"
                  defaultValue={(brand?.website as string) ?? ""}
                  placeholder="foodtruckthai.fr"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <span className="text-xs text-gray-400 mt-1 block">
                  Pas de site ? Laissez vide, nous partirons du nom seul et vous compléterez à l&apos;étape suivante.
                </span>
              </label>
              <div>
                <button className="bg-[#0f6b53] text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                  Analyser et préparer mon profil
                </button>
              </div>
              <p className="text-xs text-gray-400">Comptez une vingtaine de secondes.</p>
            </form>
          </section>
        )}

        {etape === 2 && (
          <>
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h1 className="text-xl font-bold text-[#12211c]">Voilà ce que nous avons compris.</h1>
              <p className="text-sm text-gray-500 mt-2">
                Corrigez ce qui est faux, complétez ce qui manque. Tout ceci pilote ensuite chaque texte et chaque
                visuel produits par l&apos;application — et reste modifiable à tout moment dans Ma marque.
              </p>

              <form action={validerProfil} className="mt-6 grid gap-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm">
                    <span className="block font-semibold text-[#12211c] mb-1">Nom</span>
                    <input name="nom" defaultValue={(brand?.name as string) ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <span className="block font-semibold text-[#12211c] mb-1">Ville</span>
                    <input name="ville" defaultValue={(brand?.city as string) ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <span className="block font-semibold text-[#12211c] mb-1">Compte Instagram</span>
                    <input
                      name="handle"
                      defaultValue={(brand?.handle as string) ?? ""}
                      placeholder="sans le @"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <span className="text-xs text-gray-400 mt-1 block">Il apparaît en bas de chaque visuel.</span>
                  </label>
                  <label className="text-sm">
                    <span className="block font-semibold text-[#12211c] mb-1">Site</span>
                    <input name="site" defaultValue={(brand?.website as string) ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </label>
                </div>

                {CHAMPS.map((c) => (
                  <label key={c.cle} className="text-sm">
                    <span className="block font-semibold text-[#12211c] mb-1">{c.titre}</span>
                    <textarea
                      name={c.cle}
                      rows={c.lignes ?? 2}
                      defaultValue={brief[c.cle] ?? ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <span className="text-xs text-gray-400 block mt-0.5">{c.aide}</span>
                  </label>
                ))}

                <label className="text-sm">
                  <span className="block font-semibold text-[#12211c] mb-1">L&apos;allure que vous voulez</span>
                  <textarea
                    name="design"
                    rows={3}
                    defaultValue={brief.design ?? ""}
                    placeholder="Fonds sombres, couleurs chaudes, photos de près, jamais de blanc clinique."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <span className="text-xs text-gray-400 block mt-0.5">
                    Facultatif. Sert à écrire vos couleurs et vos visuels.
                  </span>
                </label>

                <div>
                  <button className="bg-[#0f6b53] text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90">
                    C&apos;est bon, continuer
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
              <h2 className="font-bold text-[#12211c]">Votre carte</h2>
              <p className="text-sm text-gray-500 mt-1">
                Les prix servent de garde-fou : l&apos;application refuse de publier un prix qui ne figure pas ici.
              </p>

              <div className="mt-4 grid gap-1">
                {(produits ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400">Rien pour l&apos;instant. Ajoutez au moins vos best-sellers.</p>
                ) : (
                  (produits ?? []).map((p) => (
                    <div key={p.id as string} className="flex items-center gap-3 py-1.5 border-b border-gray-100">
                      <span className="text-sm text-[#12211c] flex-1">{p.name as string}</span>
                      <span className="text-sm text-gray-500 tabular-nums">{euros(p.price_cents as number | null)}</span>
                      <form action={retirerProduit}>
                        <input type="hidden" name="id" value={p.id as string} />
                        <button className="text-xs text-gray-300 hover:text-red-600">×</button>
                      </form>
                    </div>
                  ))
                )}
              </div>

              <form action={ajouterProduit} className="flex gap-2 mt-4 flex-wrap">
                <input name="produit" placeholder="Nom du plat" className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]" />
                <input name="prix" placeholder="12,50" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28" />
                <button className="border border-[#0f6b53] text-[#0f6b53] rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#e5f2ee]">
                  Ajouter
                </button>
              </form>
            </section>
          </>
        )}

        {etape === 3 && (
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <h1 className="text-xl font-bold text-[#12211c]">Dernière étape : vos comptes.</h1>
            <p className="text-sm text-gray-500 mt-2">
              Connectez Instagram et votre Page Facebook pour que l&apos;application puisse publier à votre place.
              Vous vous authentifiez chez Meta, nous ne voyons jamais votre mot de passe et vous pouvez retirer
              l&apos;accès quand vous voulez.
            </p>

            <div className="mt-5 grid gap-2">
              {[
                { p: "instagram", n: "Instagram" },
                { p: "facebook", n: "Page Facebook" },
              ].map((r) => {
                const c = (comptes ?? []).find((x) => x.platform === r.p);
                return (
                  <div key={r.p} className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3">
                    <span className="text-sm font-semibold text-[#12211c] flex-1">{r.n}</span>
                    <span
                      className={`text-[10px] font-bold uppercase rounded-full px-2.5 py-1 ${
                        c ? "bg-[#e5f2ee] text-[#0f6b53]" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {c ? "connecté" : "non connecté"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5 flex-wrap">
              <Link
                href="/reseaux"
                className="bg-[#0f6b53] text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                Connecter mes comptes
              </Link>
              <form action={terminer}>
                <button className="border border-gray-300 rounded-lg px-5 py-2.5 text-sm font-semibold text-gray-600 hover:border-[#0f6b53] hover:text-[#0f6b53]">
                  Plus tard, entrer dans l&apos;application
                </button>
              </form>
            </div>

            <p className="text-xs text-gray-400 mt-5 leading-relaxed">
              Ensuite : saisissez vos emplacements ou vos horaires, importez quelques photos, et le calendrier du mois
              s&apos;écrira tout seul. Rien ne part sans votre accord tant que vous n&apos;activez pas le pilote
              automatique.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
