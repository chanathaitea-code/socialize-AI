import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { chiffrer, verifierEtat } from "@/lib/crypto";
import { echangerCode, fiches } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Retour de Google : on range les jetons chiffrés et on repère la fiche. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const retour = (p: string) => NextResponse.redirect(new URL(`/google?${p}`, req.nextUrl.origin));

  if (sp.get("error")) return retour(`err=${encodeURIComponent(sp.get("error_description") ?? sp.get("error")!)}`);
  const code = sp.get("code");
  const etat = sp.get("state") ?? "";
  if (!code || !verifierEtat(etat)) return retour("err=Retour%20Google%20invalide");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const { data: brands } = await supabase.from("brands").select("id").limit(1);
  const brandId = brands?.[0]?.id as string | undefined;
  if (!brandId) return retour("err=Marque%20introuvable");

  try {
    const redirection = new URL("/google/callback", req.nextUrl.origin).toString();
    const jetons = await echangerCode(code, redirection);

    // La fiche n'est lisible qu'une fois l'accès ouvert par Google : on
    // enregistre la connexion même si la liste revient vide.
    let ressource: string | null = null;
    let titre: string | null = null;
    let avertissement = "";
    try {
      const liste = await fiches(jetons.access_token);
      if (liste.length) {
        ressource = liste[0].nom;
        titre = liste[0].titre;
      } else {
        avertissement = "Aucune fiche trouvée sur ce compte Google.";
      }
    } catch (e) {
      avertissement = e instanceof Error ? e.message : "fiche illisible pour l'instant";
    }

    const { error } = await supabase.from("social_accounts").upsert(
      {
        brand_id: brandId,
        platform: "gbp",
        provider: "direct",
        status: "connected",
        external_id: ressource,
        handle: titre,
        encrypted_credentials: chiffrer(JSON.stringify(jetons)),
        last_health_check: new Date().toISOString(),
      },
      { onConflict: "brand_id,platform" }
    );
    if (error) return retour(`err=${encodeURIComponent(error.message)}`);

    return retour(
      avertissement
        ? `ok=${encodeURIComponent(`Compte Google connecté. ${avertissement}`)}`
        : `ok=${encodeURIComponent(`Fiche « ${titre} » connectée`)}`
    );
  } catch (e) {
    return retour(`err=${encodeURIComponent(e instanceof Error ? e.message : "connexion impossible")}`);
  }
}
