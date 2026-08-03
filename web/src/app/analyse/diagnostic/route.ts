import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { dechiffrer } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com";

/**
 * Page de mise au point : essaie plusieurs appels de statistiques et renvoie la
 * réponse brute de Meta pour chacun. Sert à identifier les métriques encore
 * acceptées, qui changent d'une version d'API à l'autre.
 */
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("connexion requise", { status: 401 });

  const { data: comptes } = await supabase
    .from("social_accounts")
    .select("platform, external_id, encrypted_credentials");
  const fb = comptes?.find((c) => c.platform === "facebook");
  const ig = comptes?.find((c) => c.platform === "instagram");
  if (!fb) return NextResponse.json({ erreur: "Page non connectée" });

  const jeton = dechiffrer(String(fb.encrypted_credentials));
  const { data: pubs } = await supabase
    .from("publication_log")
    .select("platform, remote_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);
  const dernierPost = pubs?.find((p) => p.platform === "facebook")?.remote_id;
  const derniereStory = pubs?.find((p) => p.platform === "instagram")?.remote_id;

  const essais: { appel: string; reponse: unknown }[] = [];
  const essayer = async (libelle: string, url: string) => {
    try {
      const r = await fetch(`${url}&access_token=${encodeURIComponent(jeton)}`, { cache: "no-store" });
      essais.push({ appel: libelle, reponse: await r.json() });
    } catch (e) {
      essais.push({ appel: libelle, reponse: { erreur: e instanceof Error ? e.message : "échec" } });
    }
  };

  for (const v of ["v21.0", "v23.0"]) {
    if (dernierPost) {
      await essayer(`${v} post impressions`, `${GRAPH}/${v}/${dernierPost}/insights?metric=post_impressions`);
      await essayer(`${v} post reactions`, `${GRAPH}/${v}/${dernierPost}/insights?metric=post_reactions_by_type_total`);
      await essayer(`${v} post champs publics`, `${GRAPH}/${v}/${dernierPost}?fields=likes.summary(true),comments.summary(true),shares`);
    }
    await essayer(`${v} page impressions`, `${GRAPH}/${v}/${fb.external_id}/insights?metric=page_impressions&period=day`);
    if (derniereStory) {
      await essayer(`${v} story insights`, `${GRAPH}/${v}/${derniereStory}/insights?metric=reach`);
      await essayer(`${v} story champs`, `${GRAPH}/${v}/${derniereStory}?fields=id,media_type,timestamp`);
    }
    if (ig?.external_id) {
      await essayer(`${v} stories du compte`, `${GRAPH}/${v}/${ig.external_id}/stories?fields=id,timestamp`);
    }
  }

  return NextResponse.json({ post: dernierPost, story: derniereStory, essais }, { status: 200 });
}
