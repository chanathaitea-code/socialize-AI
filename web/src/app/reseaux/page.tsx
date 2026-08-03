import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Nav from "../nav";
import { dechiffrer } from "@/lib/crypto";
import { deconnecter } from "./actions";

export const dynamic = "force-dynamic";

type Compte = {
  id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  token_expires_at: string | null;
  connected_at: string | null;
};

const LIBELLE: Record<string, { nom: string; couleur: string }> = {
  instagram: { nom: "Instagram", couleur: "#d6249f" },
  facebook: { nom: "Page Facebook", couleur: "#1877f2" },
};

function joursRestants(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function ReseauxPage({
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

  const { data } = await supabase
    .from("social_accounts")
    .select("id, platform, handle, display_name, status, token_expires_at, connected_at, encrypted_credentials")
    .order("platform");
  const comptes = (data ?? []) as (Compte & { encrypted_credentials?: string })[];
  const parPlateforme = new Map(comptes.map((c) => [c.platform, c]));

  // Autorisations réellement accordées : c'est ce qui explique la plupart des
  // refus de l'API, et personne ne peut le deviner sans le demander à Meta.
  let accordees: string[] = [];
  let refusees: string[] = [];
  let erreurPermissions: string | null = null;
  const compteFb = parPlateforme.get("facebook");
  if (compteFb?.encrypted_credentials) {
    try {
      const jeton = dechiffrer(String(compteFb.encrypted_credentials));
      const r = await fetch(
        `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(jeton)}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      for (const p of j.data ?? []) {
        (p.status === "granted" ? accordees : refusees).push(p.permission);
      }
    } catch (e) {
      erreurPermissions = e instanceof Error ? e.message : "vérification impossible";
    }
  }
  const ATTENDUES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    "read_insights",
  ];
  const manquantes = compteFb ? ATTENDUES.filter((p) => !accordees.includes(p)) : [];

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/reseaux" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-[#12211c]">Mes réseaux</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Connectez une fois vos comptes, l&apos;application pourra ensuite publier à votre place, avec votre
          validation avant chaque envoi. Vous pouvez tout déconnecter à n&apos;importe quel moment.
        </p>

        {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Problème : {err}</div>}
        {ok && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {ok}</div>}

        <div className="mt-6 grid gap-3">
          {["instagram", "facebook"].map((p) => {
            const c = parPlateforme.get(p);
            const jours = joursRestants(c?.token_expires_at ?? null);
            const alerte = jours !== null && jours < 10;
            return (
              <div key={p} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 flex-wrap">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold"
                  style={{ background: LIBELLE[p].couleur }}
                >
                  {LIBELLE[p].nom.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#12211c]">{LIBELLE[p].nom}</div>
                  {c ? (
                    <div className="text-sm text-gray-500">
                      {c.display_name ?? c.handle ?? "compte connecté"}
                      {jours !== null && (
                        <span className={alerte ? "text-amber-700 font-semibold" : ""}>
                          {" "}· accès valide encore {jours} jour{jours > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">non connecté</div>
                  )}
                </div>
                {c ? (
                  <form action={deconnecter}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-sm text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg px-3 py-1.5">
                      Déconnecter
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-gray-400">connexion commune ci-dessous</span>
                )}
              </div>
            );
          })}
        </div>

        <a
          href="/reseaux/start"
          className="mt-5 inline-flex items-center justify-center bg-[#1877f2] text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          {comptes.length ? "Reconnecter mes comptes Meta" : "Connecter Instagram et Facebook"}
        </a>

        {compteFb && (
          <div
            className={`mt-6 rounded-xl border p-5 ${
              manquantes.length ? "border-amber-200 bg-amber-50" : "border-[#c8e2da] bg-[#f7fbf9]"
            }`}
          >
            <div className="font-bold text-[#12211c] text-sm">Autorisations accordées</div>
            {erreurPermissions ? (
              <p className="text-sm text-red-700 mt-1">Vérification impossible : {erreurPermissions}</p>
            ) : manquantes.length ? (
              <>
                <p className="text-sm text-amber-800 mt-1">
                  Il manque {manquantes.length} autorisation{manquantes.length > 1 ? "s" : ""} :{" "}
                  <span className="font-mono text-[12px]">{manquantes.join(", ")}</span>.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Reconnectez les comptes ci-dessus et acceptez tout l&apos;écran Facebook.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#0f6b53] mt-1">
                Tout est en ordre, les {accordees.length} autorisations nécessaires sont accordées.
              </p>
            )}
            {refusees.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-2">Refusées : {refusees.join(", ")}</p>
            )}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 space-y-2">
          <div className="font-bold text-[#12211c]">Ce que l&apos;application pourra faire</div>
          <p>
            Publier les contenus que vous aurez validés sur votre Page et votre compte Instagram professionnel, et lire
            les statistiques de ces publications. Elle ne lit pas vos messages privés, ne publie rien sans votre accord
            tant que le mode automatique n&apos;est pas activé, et n&apos;accède à aucun autre compte.
          </p>
          <p>
            Les autorisations sont révocables des deux côtés : ici avec le bouton Déconnecter, et depuis les paramètres
            de sécurité de votre compte Facebook.
          </p>
        </div>
      </div>
    </main>
  );
}
