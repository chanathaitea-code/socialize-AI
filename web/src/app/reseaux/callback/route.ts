import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { chiffrer, verifierEtat } from "@/lib/crypto";
import { jetonLongueDuree, pagesDuCompte } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function retour(req: NextRequest, params: string) {
  return NextResponse.redirect(new URL(`/reseaux?${params}`, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // L'utilisateur a refusé l'autorisation dans la fenêtre Facebook
  if (sp.get("error")) {
    return retour(req, `err=${encodeURIComponent(sp.get("error_description") ?? "Autorisation refusée")}`);
  }

  const code = sp.get("code");
  const etat = sp.get("state") ?? "";
  const etatCookie = req.cookies.get("meta_oauth_state")?.value;
  if (!code) return retour(req, "err=Code%20d%27autorisation%20manquant");
  if (!etat || etat !== etatCookie || !verifierEtat(etat)) {
    return retour(req, "err=Session%20de%20connexion%20invalide%2C%20recommencez");
  }

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

    const { data: brands } = await supabase.from("brands").select("id").limit(1);
    const brandId = brands?.[0]?.id as string | undefined;
    if (!brandId) return retour(req, "err=Marque%20introuvable");

    const redirectUri = new URL("/reseaux/callback", req.nextUrl.origin).toString();
    const jeton = await jetonLongueDuree(code, redirectUri);
    const pages = await pagesDuCompte(jeton.access_token);
    if (!pages.length) {
      return retour(req, "err=Aucune%20Page%20Facebook%20administr%C3%A9e%20par%20ce%20compte");
    }

    // On retient en priorité la Page qui porte un compte Instagram professionnel
    const page = pages.find((p) => p.instagram_business_account) ?? pages[0];
    const expire = jeton.expires_in
      ? new Date(Date.now() + jeton.expires_in * 1000).toISOString()
      : null;

    type LigneCompte = {
      brand_id: string;
      platform: string;
      handle: string | null;
      provider: string;
      status: string;
      external_id: string;
      display_name: string;
      encrypted_credentials: string;
      token_expires_at: string | null;
      connected_at: string;
      details: Record<string, unknown>;
    };

    const lignes: LigneCompte[] = [
      {
        brand_id: brandId,
        platform: "facebook",
        handle: page.name,
        provider: "direct",
        status: "connected",
        external_id: page.id,
        display_name: page.name,
        encrypted_credentials: chiffrer(page.access_token),
        token_expires_at: expire,
        connected_at: new Date().toISOString(),
        details: { pages: pages.map((p) => ({ id: p.id, name: p.name })) },
      },
    ];

    if (page.instagram_business_account) {
      lignes.push({
        brand_id: brandId,
        platform: "instagram",
        handle: page.instagram_business_account.username ?? null,
        provider: "direct",
        status: "connected",
        external_id: page.instagram_business_account.id,
        display_name: page.instagram_business_account.username ?? page.name,
        // La publication Instagram passe par le jeton de la Page rattachée
        encrypted_credentials: chiffrer(page.access_token),
        token_expires_at: expire,
        connected_at: new Date().toISOString(),
        details: { page_id: page.id, page_name: page.name },
      });
    }

    const { error } = await supabase
      .from("social_accounts")
      .upsert(lignes, { onConflict: "brand_id,platform" });
    if (error) return retour(req, `err=${encodeURIComponent(error.message)}`);

    const reponse = retour(
      req,
      `ok=${encodeURIComponent(
        page.instagram_business_account
          ? "Page Facebook et compte Instagram connectés"
          : "Page Facebook connectée, aucun compte Instagram professionnel rattaché"
      )}`
    );
    reponse.cookies.delete("meta_oauth_state");
    return reponse;
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    return retour(req, `err=${encodeURIComponent(detail)}`);
  }
}
