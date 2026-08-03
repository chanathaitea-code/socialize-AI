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

  const v = "v23.0";
  const METRIQUES_POST = [
    "post_impressions_unique",
    "post_impressions_organic",
    "post_clicks",
    "post_reactions_by_type_total",
    "post_activity",
    "post_engaged_users",
    "post_video_views",
    "post_views",
  ];
  const METRIQUES_PAGE = [
    "page_impressions_unique",
    "page_post_engagements",
    "page_fans",
    "page_views_total",
    "page_daily_follows_unique",
    "page_total_actions",
  ];

  if (dernierPost) {
    for (const m of METRIQUES_POST) {
      await essayer(`post ${m}`, `${GRAPH}/${v}/${dernierPost}/insights?metric=${m}`);
    }
    await essayer("post champs simples", `${GRAPH}/${v}/${dernierPost}?fields=id,created_time`);
  }
  for (const m of METRIQUES_PAGE) {
    await essayer(`page ${m}`, `${GRAPH}/${v}/${fb.external_id}/insights?metric=${m}&period=day`);
  }
  if (ig?.external_id) {
    await essayer("media du compte", `${GRAPH}/${v}/${ig.external_id}/media?fields=id,media_type,timestamp&limit=3`);
    await essayer("stories du compte", `${GRAPH}/${v}/${ig.external_id}/stories?fields=id,timestamp`);
  }

  return NextResponse.json({ post: dernierPost, story: derniereStory, essais }, { status: 200 });
}
