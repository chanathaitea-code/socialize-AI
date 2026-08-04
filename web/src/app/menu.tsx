"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppModule } from "@/lib/modules";

/**
 * Le menu latéral, repris de la maquette : familles du pilotage à la
 * configuration, pour qu'on sache toujours où on est.
 *
 * Chaque famille appartient à un module. Un membre qui n'a que la communication
 * ne voit jamais les écrans de prospection, et réciproquement. Ce filtrage est
 * du confort : la vraie barrière est en base, dans les policies. Ne pas s'y fier
 * pour la sécurité.
 */
type Lien = { href: string; label: string; icone: string };
type Famille = { titre: string; module: AppModule | "core"; liens: Lien[] };

const FAMILLES: Famille[] = [
  {
    titre: "Pilotage",
    module: "core",
    liens: [
      { href: "/tableau", label: "Tableau de bord", icone: "▦" },
      { href: "/jour", label: "Aujourd’hui", icone: "☀" },
      { href: "/calendrier", label: "Calendrier", icone: "▤" },
      { href: "/emplacements", label: "Emplacements", icone: "⚑" },
    ],
  },
  {
    titre: "Contenus",
    module: "communication",
    liens: [
      { href: "/studio", label: "Studio de création", icone: "✦" },
      { href: "/stories", label: "Stories", icone: "❑" },
      { href: "/semaine", label: "Story de la semaine", icone: "▣" },
      { href: "/design", label: "Design et photos", icone: "◈" },
    ],
  },
  {
    titre: "Mesure",
    module: "communication",
    liens: [
      { href: "/journal", label: "Journal", icone: "≡" },
      { href: "/analyse", label: "Analyse", icone: "◔" },
      { href: "/rapport", label: "Rapport", icone: "◫" },
    ],
  },
  {
    titre: "Prospection",
    module: "prospection",
    liens: [
      { href: "/opportunites", label: "Opportunités", icone: "◎" },
      { href: "/territoire", label: "Territoire", icone: "◇" },
    ],
  },
  {
    titre: "Configuration",
    module: "core",
    liens: [
      { href: "/marque", label: "Ma marque", icone: "◇" },
      { href: "/reseaux", label: "Mes réseaux", icone: "⚭" },
      { href: "/modules", label: "Modules et droits", icone: "⚙" },
    ],
  },
];

function visibleFamilles(modules: AppModule[]): Famille[] {
  return FAMILLES.filter(
    (f) => f.module === "core" || modules.includes(f.module),
  );
}

export default function Menu({
  marque,
  activite,
  modules,
}: {
  marque: string;
  activite: string;
  modules: AppModule[];
}) {
  const chemin = usePathname();
  const familles = visibleFamilles(modules);

  return (
    <aside className="hidden md:flex md:flex-col w-[230px] shrink-0 bg-[#0b1512] text-white min-h-screen sticky top-0">
      <div className="px-5 pt-5 pb-4">
        <div className="font-extrabold text-[17px] leading-none">
          Social<span className="text-[#3ecf9a]">Flow</span> AI
        </div>
        <div className="text-[11px] text-white/40 mt-1">Community manager autonome</div>
      </div>

      <div className="mx-3 mb-4 rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5">
        <div className="text-sm font-bold leading-tight">{marque}</div>
        <div className="text-[11px] text-white/45 leading-snug mt-0.5">{activite}</div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-6">
        {familles.map((f) => (
          <div key={f.titre} className="mb-4">
            <div className="px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 mb-1.5">
              {f.titre}
            </div>
            {f.liens.map((l) => {
              const actif = chemin === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    actif ? "bg-white/[0.10] text-white font-semibold" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className={`text-[13px] ${actif ? "text-[#3ecf9a]" : "text-white/35"}`}>{l.icone}</span>
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Sur téléphone, le menu latéral disparaît : on garde une barre de liens. */
export function MenuMobile({ modules }: { modules: AppModule[] }) {
  const chemin = usePathname();
  const tous = visibleFamilles(modules).flatMap((f) => f.liens);
  return (
    <nav className="md:hidden bg-[#0b1512] text-white px-3 py-2 flex gap-1 overflow-x-auto">
      {tous.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap text-[12px] rounded-lg px-2.5 py-1.5 ${
            chemin === l.href ? "bg-white/15 font-semibold" : "text-white/60"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
