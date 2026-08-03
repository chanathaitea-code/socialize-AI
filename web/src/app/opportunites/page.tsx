import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getActiveModules } from "@/lib/modules.server";
import { hasModule } from "@/lib/modules";
import { loadOpportunities } from "@/modules/prospection/opportunities";
import { BASELINE_WEIGHTS, type Criterion } from "@/modules/prospection/scoring";
import Nav from "../nav";
import OpportunitesClient from "./opportunites-client";

export const dynamic = "force-dynamic";

export default async function OpportunitesPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // L'écran ne s'ouvre qu'avec le module. La vraie barrière reste en base
  // (policies) ; ceci évite seulement d'afficher une page vide à qui n'y a pas droit.
  const { modules } = await getActiveModules();
  if (!hasModule(modules, "prospection")) redirect("/jour");

  const opportunities = await loadOpportunities(supabase);

  // Poids enregistrés de la marque, sinon les poids de référence.
  const { data: rows } = await supabase
    .from("scoring_weights")
    .select("criterion, weight");
  const saved: Partial<Record<Criterion, number>> = {};
  for (const r of rows ?? []) {
    saved[r.criterion as Criterion] = Number(r.weight);
  }
  const initialWeights = { ...BASELINE_WEIGHTS, ...saved };

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/opportunites" />
      <OpportunitesClient
        opportunities={opportunities}
        initialWeights={initialWeights}
      />
    </main>
  );
}
