import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getActiveModules } from "@/lib/modules.server";
import { hasModule } from "@/lib/modules";
import Nav from "../nav";
import TerritoireClient from "./territoire-client";

export const dynamic = "force-dynamic";

/** Base par défaut si la marque n'a pas encore de réglages : Gif-sur-Yvette. */
const DEFAULT_BASE = { lat: 48.6989, lng: 2.1355, label: "Gif-sur-Yvette" };

export default async function TerritoirePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { modules } = await getActiveModules();
  if (!hasModule(modules, "prospection")) redirect("/jour");

  const { data: settings } = await supabase
    .from("prospection_settings")
    .select("base_address, base_lat, base_lng, radius_km, min_headcount")
    .limit(1)
    .maybeSingle();

  const base =
    settings?.base_lat != null && settings?.base_lng != null
      ? {
          lat: settings.base_lat as number,
          lng: settings.base_lng as number,
          label: (settings.base_address as string | null) ?? "la base",
        }
      : DEFAULT_BASE;

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/territoire" />
      <TerritoireClient
        base={base}
        defaultRadiusKm={(settings?.radius_km as number | undefined) ?? 25}
        defaultMinHeadcount={(settings?.min_headcount as number | undefined) ?? 100}
      />
    </main>
  );
}
