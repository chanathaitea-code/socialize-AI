import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { saveBrand, addProduct, deleteProduct, toggleStock, prefillCarte } from "./actions";

export const dynamic = "force-dynamic";

type Brief = {
  activite?: string;
  positionnement?: string;
  cible?: string;
  ton?: string;
  zone?: string;
  objectifs?: string;
  interdits?: string;
};

const champ = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6b53]";
const label = "block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1";

export default async function MarquePage({
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

  const { data: brands } = await supabase.from("brands").select("id, name, brand_brief").limit(1);
  const brand = brands?.[0];
  const brief = (brand?.brand_brief ?? {}) as Brief;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price_cents, out_of_stock")
    .order("price_cents", { ascending: true });

  const euro = (c: number | null) => (c == null ? "—" : (c / 100).toFixed(2).replace(".", ",") + " €");

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
        <h1 className="font-extrabold text-[#12211c]">
          Social<span className="text-[#0f6b53]">Flow</span> AI
        </h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/emplacements" className="text-gray-500 hover:text-[#0f6b53]">Emplacements</Link>
          <Link href="/semaine" className="text-gray-500 hover:text-[#0f6b53]">Story de la semaine</Link>
          <span className="font-semibold text-[#0f6b53]">Ma marque</span>
        </nav>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[#12211c]">Profil de marque</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Rempli une seule fois. C&apos;est ce qui permettra à l&apos;IA d&apos;écrire dans votre ton, et à l&apos;application de vérifier
          automatiquement les prix avant chaque publication.
        </p>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        <div className="grid gap-5 lg:grid-cols-2 mt-6">
          <form action={saveBrand} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <label className={label}>Nom de la marque</label>
              <input name="nom" defaultValue={brand?.name ?? ""} className={champ} />
            </div>
            <div>
              <label className={label}>Activité</label>
              <input name="activite" defaultValue={brief.activite ?? ""} placeholder="Food truck et restaurant à emporter de street food thaï" className={champ} />
            </div>
            <div>
              <label className={label}>Positionnement</label>
              <input name="positionnement" defaultValue={brief.positionnement ?? ""} placeholder="Authentique, premium mais accessible, recettes de Bangkok par notre cheffe" className={champ} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Public cible</label>
                <input name="cible" defaultValue={brief.cible ?? ""} placeholder="18-45 ans, étudiants, actifs" className={champ} />
              </div>
              <div>
                <label className={label}>Zone</label>
                <input name="zone" defaultValue={brief.zone ?? ""} placeholder="Essonne, Yvelines, 92" className={champ} />
              </div>
            </div>
            <div>
              <label className={label}>Ton de communication</label>
              <input name="ton" defaultValue={brief.ton ?? ""} placeholder="Convivial, gourmand, énergique — vouvoiement" className={champ} />
            </div>
            <div>
              <label className={label}>Objectifs</label>
              <input name="objectifs" defaultValue={brief.objectifs ?? ""} placeholder="Trafic au camion, privatisations et traiteur, communauté" className={champ} />
            </div>
            <div>
              <label className={label}>À ne jamais publier</label>
              <textarea name="interdits" defaultValue={brief.interdits ?? ""} rows={2} placeholder="Mots interdits, sujets sensibles, promesses à éviter..." className={champ} />
            </div>
            <button className="w-full bg-[#0f6b53] text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90">
              Enregistrer le profil
            </button>
          </form>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-bold text-[#12211c]">Carte et prix</h3>
              <span className="text-xs text-gray-400">{products?.length ?? 0} produits</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Source de vérité : aucun contenu ne partira avec un prix qui ne correspond pas à cette liste.
            </p>

            {(products?.length ?? 0) === 0 && (
              <form action={prefillCarte} className="mb-4">
                <button className="w-full rounded-lg border border-[#0f6b53] text-[#0f6b53] py-2 text-sm font-semibold hover:bg-[#e5f2ee]">
                  ⚡ Pré-remplir avec la carte food truck Chana Thaï
                </button>
                <p className="text-[11px] text-gray-400 mt-1 text-center">Nems, Pad Thaï, Crousty, Panang, bubble tea et formules</p>
              </form>
            )}

            <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
              {(products ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-2">
                  <span className={`text-sm flex-1 ${p.out_of_stock ? "line-through text-gray-400" : "text-[#12211c]"}`}>{p.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{euro(p.price_cents)}</span>
                  <form action={toggleStock}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="rupture" value={String(p.out_of_stock)} />
                    <button
                      title={p.out_of_stock ? "Remettre en vente" : "Signaler en rupture"}
                      className={`text-[10px] rounded px-2 py-1 font-semibold ${p.out_of_stock ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-800"}`}
                    >
                      {p.out_of_stock ? "rupture" : "en vente"}
                    </button>
                  </form>
                  <form action={deleteProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs text-gray-300 hover:text-red-600">✕</button>
                  </form>
                </div>
              ))}
            </div>

            <form action={addProduct} className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <input name="nom" placeholder="Nouveau produit" className={`${champ} flex-1`} />
              <input name="prix" placeholder="13" className={`${champ} w-20`} />
              <button className="bg-[#12211c] text-white rounded-lg px-3 text-sm font-semibold">Ajouter</button>
            </form>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Un produit signalé en rupture est automatiquement retiré des contenus à venir.
        </p>
      </div>
    </main>
  );
}
