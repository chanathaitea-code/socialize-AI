import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { THEMES } from "@/lib/story";
import Nav from "../nav";
import Televerseur from "./televerseur";
import {
  enregistrerDesign,
  fabriquerFond,
  proposerChartes,
  supprimerCharte,
  supprimerPhoto,
} from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXEMPLE =
  "Ambiance marché de nuit à Bangkok : fonds sombres, néons rose et vert jade, typo bien grasse, photos de plats prises de près, vapeur visible. Jamais de blanc clinique ni de photos de studio.";

export default async function DesignPage({
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

  const { data: brands } = await supabase.from("brands").select("id, brand_brief").limit(1);
  const brand = brands?.[0];
  const brief = (brand?.brand_brief ?? {}) as Record<string, string>;

  const [{ data: chartes }, { data: medias }] = await Promise.all([
    supabase.from("brand_themes").select("id, cle, nom, bg, accent, photo").order("created_at", { ascending: false }),
    supabase
      .from("media_assets")
      .select("id, storage_path, ai_tags, created_at")
      .eq("kind", "photo")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const photos = (medias ?? []).map((m) => ({
    id: m.id as string,
    chemin: m.storage_path as string,
    ia: ((m.ai_tags ?? []) as string[]).includes("fond-ia"),
    url: supabase.storage.from("media").getPublicUrl(m.storage_path as string).data.publicUrl,
  }));

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/design" />

      <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6">
        <div>
          <h2 className="text-xl font-bold text-[#12211c]">Design</h2>
          <p className="text-sm text-gray-500 mt-1">
            L&apos;allure de vos publications : ce que vous voulez qu&apos;on voie, vos photos, et des couleurs
            écrites à partir de votre description.
          </p>
        </div>

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}
        {ok && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ {ok}
          </div>
        )}

        {/* 1. La description */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-[#12211c]">Ce que vous voulez comme design</h3>
          <p className="text-sm text-gray-500 mt-1">
            Écrivez-le comme vous le diriez à un graphiste : les couleurs, l&apos;ambiance, ce que vous ne voulez
            surtout pas. Cette description sert à tout ce qui est fabriqué ensuite.
          </p>
          <form action={enregistrerDesign} className="mt-4">
            <textarea
              name="design"
              rows={5}
              defaultValue={brief.design ?? ""}
              placeholder={EXEMPLE}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-3 mt-3 flex-wrap">
              <button className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
                Enregistrer
              </button>
              <button
                formAction={proposerChartes}
                className="border border-[#0f6b53] text-[#0f6b53] rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#e5f2ee]"
              >
                Proposer trois chartes de couleurs
              </button>
            </div>
          </form>
        </section>

        {/* 2. Les couleurs */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-[#12211c]">Vos couleurs</h3>
          <p className="text-sm text-gray-500 mt-1">
            Les quatre premières sont livrées avec l&apos;application. Celles que vous vous faites écrire viennent
            s&apos;ajouter, et se retrouvent dans le choix des couleurs de chaque story.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {Object.entries(THEMES).map(([cle, t]) => (
              <div key={cle} className="rounded-xl overflow-hidden border border-gray-200">
                <div className="h-20 flex items-end p-2" style={{ background: t.bg }}>
                  <span className="w-6 h-6 rounded-full" style={{ background: t.accent }} />
                </div>
                <div className="px-2 py-2 text-xs font-semibold text-[#12211c]">{t.nom}</div>
              </div>
            ))}
            {(chartes ?? []).map((t) => (
              <div key={t.id as string} className="rounded-xl overflow-hidden border border-[#c8e2da]">
                <div className="h-20 flex items-end p-2" style={{ background: String(t.bg) }}>
                  <span className="w-6 h-6 rounded-full" style={{ background: String(t.accent) }} />
                </div>
                <div className="px-2 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#12211c] flex-1">{String(t.nom)}</span>
                  <form action={supprimerCharte}>
                    <input type="hidden" name="id" value={t.id as string} />
                    <button className="text-xs text-gray-400 hover:text-red-600">×</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. La bibliothèque */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <h3 className="font-bold text-[#12211c]">Vos photos</h3>
              <p className="text-sm text-gray-500 mt-1">
                {photos.length} image{photos.length > 1 ? "s" : ""} dans la bibliothèque.
              </p>
            </div>
            {brand && <Televerseur brandId={brand.id as string} />}
          </div>

          {photos.length === 0 ? (
            <p className="text-sm text-gray-400 mt-4">
              Aucune photo pour l&apos;instant. Les stories fonctionnent sans, mais elles sont bien plus efficaces
              avec vos vraies photos.
            </p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
              {photos.map((p) => (
                <div key={p.id} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                  {p.ia && (
                    <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-white/90 text-[#4b2fa8] rounded px-1">
                      IA
                    </span>
                  )}
                  <form action={supprimerPhoto} className="absolute top-1 right-1">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="chemin" value={p.chemin} />
                    <button className="w-5 h-5 rounded-full bg-white/90 text-gray-500 hover:text-red-600 text-xs leading-none">
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Les fonds fabriqués */}
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-[#12211c]">Faire fabriquer une image par l&apos;IA</h3>
          <p className="text-sm text-gray-500 mt-1">
            Décrivez l&apos;image voulue. Elle est fabriquée au format vertical d&apos;une story et rangée dans vos
            photos, prête à servir de fond. Vous pouvez partir d&apos;une de vos photos pour garder votre vrai plat.
          </p>
          <form action={fabriquerFond} className="mt-4 grid gap-3">
            <textarea
              name="consigne"
              rows={3}
              placeholder="Un pad thaï fumant vu de près sur une table en bois sombre, lumière chaude de fin de journée, baguettes posées à côté."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {photos.length > 0 && (
              <label className="text-sm">
                <span className="block font-semibold text-[#12211c] mb-1">Partir d&apos;une de vos photos</span>
                <select name="reference" defaultValue="" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="">— aucune, tout inventer —</option>
                  {photos.slice(0, 20).map((p, i) => (
                    <option key={p.id} value={p.chemin}>
                      Photo {i + 1}
                      {p.ia ? " (fabriquée)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div>
              <button className="bg-[#0f6b53] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
                Fabriquer l&apos;image
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            La fabrication d&apos;images n&apos;est pas comprise dans la clé Google gratuite : elle demande d&apos;activer
            la facturation sur le compte Google AI, pour environ quatre centimes par image. Tant que ce n&apos;est pas
            fait, le bouton vous le dira au lieu d&apos;échouer en silence. Les couleurs, elles, fonctionnent déjà.
          </p>
        </section>
      </div>
    </main>
  );
}
