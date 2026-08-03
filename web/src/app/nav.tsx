import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "./emplacements/actions";

const LIENS = [
  { href: "/jour", label: "Aujourd\u2019hui" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/emplacements", label: "Emplacements" },
  { href: "/stories", label: "Stories" },
  { href: "/semaine", label: "Semaine" },
  { href: "/design", label: "Design" },
  { href: "/studio", label: "Studio" },
  { href: "/journal", label: "Journal" },
  { href: "/analyse", label: "Analyse" },
  { href: "/rapport", label: "Rapport" },
  { href: "/marque", label: "Ma marque" },
  { href: "/reseaux", label: "Mes réseaux" },
];

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
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
      <h1 className="font-extrabold text-[#12211c]">
        Social<span className="text-[#0f6b53]">Flow</span> AI
      </h1>
      <nav className="flex gap-3 text-sm">
        {LIENS.map((l) =>
          l.href === actif ? (
            <span key={l.href} className="font-semibold text-[#0f6b53]">
              {l.label}
            </span>
          ) : (
            <Link key={l.href} href={l.href} className="text-gray-500 hover:text-[#0f6b53]">
              {l.label}
            </Link>
          )
        )}
      </nav>
      <form action={signOut} className="ml-auto">
        <button className="text-sm text-gray-500 hover:text-red-600">Déconnexion</button>
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
