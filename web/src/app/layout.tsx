import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import Menu, { MenuMobile } from "./menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialFlow AI",
  description: "Community manager autonome",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Le menu n'apparaît qu'une fois connecté : la page de connexion reste nue.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let marque = "Ma marque";
  let activite = "";
  if (user) {
    const { data } = await supabase.from("brands").select("name, brand_brief").limit(1);
    marque = String(data?.[0]?.name ?? "Ma marque");
    activite = String(((data?.[0]?.brand_brief ?? {}) as Record<string, string>).activite ?? "");
  }

  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full font-sans bg-[#f4f4f1]">
        {user ? (
          <div className="flex min-h-screen">
            <Menu marque={marque} activite={activite.slice(0, 60)} />
            <div className="flex-1 min-w-0">
              <MenuMobile />
              {children}
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
