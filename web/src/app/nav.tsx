import Link from "next/link";
import { signOut } from "./emplacements/actions";

const LIENS = [
  { href: "/emplacements", label: "Emplacements" },
  { href: "/semaine", label: "Story de la semaine" },
  { href: "/marque", label: "Ma marque" },
  { href: "/reseaux", label: "Mes réseaux" },
  { href: "/journal", label: "Journal" },
];

export default function Nav({ actif }: { actif: string }) {
  return (
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
  );
}
