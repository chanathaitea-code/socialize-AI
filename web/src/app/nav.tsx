import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "./emplacements/actions";

/** Le titre de chaque écran, affiché dans la barre du haut. */
const TITRES: Record<string, string> = {
  "/tableau": "Tableau de bord",
  "/jour": "Aujourd’hui",
  "/calendrier": "Calendrier",
  "/emplacements": "Emplacements",
  "/studio": "Studio de création",
  "/stories": "Stories",
  "/semaine": "Story de la semaine",
  "/design": "Design et photos",
  "/journal": "Journal",
  "/analyse": "Analyse",
  "/rapport": "Rapport",
  "/marque": "Ma marque",
  "/reseaux": "Mes réseaux",
  "/opportunites": "Opportunités",
  "/territoire": "Territoire",
  "/modules": "Modules et droits",
};

export default async function Nav({ actif }: { actif: string }) {
  // Deux situations méritent d'être visibles depuis n'importe quel écran :
  // tout est en pause, ou un compte social ne répond plus.
  const supabase = await supabaseServer();
  const [{ data: reglages }, { data: comptes }] = await Promise.all([
    supabase.from("automation_settings").select("mode").limit(1),
    supabase.from("social_accounts").select("platform, status"),
  ]);
  const enPause = reglages?.[0]?.mode === "paused";
  const casses = (comptes ?? []).filter((c) => c.status !== "connected");

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-3 flex-wrap">
        <h2 className="font-bold text-[#12211c] text-[17px]">{TITRES[actif] ?? "SocialFlow AI"}</h2>
        <span
          className={`text-[11px] font-semibold rounded-full px-3 py-1 flex items-center gap-1.5 ${
            enPause ? "bg-amber-100 text-amber-900" : "bg-[#e5f2ee] text-[#0f6b53]"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${enPause ? "bg-amber-500" : "bg-[#0f6b53]"}`} />
          {enPause ? "En pause" : "Mode semi-automatique"}
        </span>
        <Link href="/journal" className="text-xs text-gray-400 hover:text-[#0f6b53]">
          {enPause ? "relancer" : "régler"}
        </Link>
        <form action={signOut} className="ml-auto">
          <button className="text-sm text-gray-400 hover:text-red-600">Déconnexion</button>
        </form>
      </header>

      {enPause && (
        <div className="bg-amber-100 border-b border-amber-200 px-6 py-2 text-sm text-amber-900">
          <b>Tout est en pause.</b> Aucune publication ne partira, même programmée, tant que vous n&apos;aurez pas
          relancé depuis le Journal.
        </div>
      )}
      {casses.length > 0 && (
        <div className="bg-red-100 border-b border-red-200 px-6 py-2 text-sm text-red-900">
          <b>{casses.map((c) => c.platform).join(" et ")} ne répond plus.</b> Reconnectez vos comptes depuis Mes
          réseaux, sinon les publications échoueront.
        </div>
      )}
    </>
  );
}
