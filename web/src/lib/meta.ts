/** Appels à l'API Graph de Meta, isolés ici pour rester testables. */

const GRAPH = "https://graph.facebook.com/v21.0";

export const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "read_insights",
  "business_management",
].join(",");

/**
 * Avec « Facebook Login for Business », les permissions ne se demandent plus
 * par une liste de scopes : elles sont portées par une configuration créée
 * côté Meta. Passer scope en même temps déclenche « Invalid Scopes ».
 */
export function urlAutorisation(redirectUri: string, etat: string): string {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    state: etat,
    response_type: "code",
  });
  const config = process.env.META_LOGIN_CONFIG_ID;
  if (config) p.set("config_id", config);
  else p.set("scope", SCOPES);
  return `https://www.facebook.com/v21.0/dialog/oauth?${p.toString()}`;
}

async function graph<T>(chemin: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH}/${chemin}?${new URLSearchParams(params).toString()}`;
  const r = await fetch(url, { cache: "no-store" });
  const json = await r.json();
  if (!r.ok || json.error) {
    throw new Error(json?.error?.message ?? `Appel ${chemin} en échec (${r.status})`);
  }
  return json as T;
}

async function graphPost<T>(chemin: string, params: Record<string, string>): Promise<T> {
  const r = await fetch(`${GRAPH}/${chemin}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  const json = await r.json();
  if (!r.ok || json.error) {
    throw new Error(json?.error?.message ?? `Publication en échec (${r.status})`);
  }
  return json as T;
}

/** Code d'autorisation -> jeton utilisateur courte durée -> jeton longue durée (60 jours). */
export async function jetonLongueDuree(code: string, redirectUri: string) {
  const court = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: redirectUri,
    code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: court.access_token,
  });
  return long;
}

export type PageMeta = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

/** Pages administrées, avec le compte Instagram professionnel éventuellement rattaché. */
export async function pagesDuCompte(jetonUtilisateur: string): Promise<PageMeta[]> {
  const r = await graph<{ data: PageMeta[] }>("me/accounts", {
    access_token: jetonUtilisateur,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "50",
  });
  return r.data ?? [];
}

/**
 * Instagram télécharge l'image de son côté avant de pouvoir la publier. Tant
 * que le conteneur n'est pas FINISHED, media_publish répond « Media ID is not
 * available ». On patiente donc, sans dépasser une trentaine de secondes.
 */
async function attendreConteneur(conteneurId: string, jeton: string) {
  for (let essai = 0; essai < 15; essai++) {
    const r = await graph<{ status_code?: string; status?: string }>(conteneurId, {
      fields: "status_code,status",
      access_token: jeton,
    });
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") {
      throw new Error(`Instagram n'a pas pu préparer l'image (${r.status ?? r.status_code})`);
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error("Instagram met trop de temps à préparer l'image, réessayez");
}

/** Publie une story Instagram à partir d'une image accessible publiquement. */
export async function publierStoryInstagram(igUserId: string, jetonPage: string, imageUrl: string) {
  const conteneur = await graphPost<{ id: string }>(`${igUserId}/media`, {
    image_url: imageUrl,
    media_type: "STORIES",
    access_token: jetonPage,
  });
  await attendreConteneur(conteneur.id, jetonPage);
  const publie = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
    creation_id: conteneur.id,
    access_token: jetonPage,
  });
  return publie.id;
}

/** Publie une photo sur la Page Facebook, avec sa légende. */
export async function publierPhotoFacebook(pageId: string, jetonPage: string, imageUrl: string, message: string) {
  const r = await graphPost<{ id: string; post_id?: string }>(`${pageId}/photos`, {
    url: imageUrl,
    message,
    access_token: jetonPage,
  });
  return r.post_id ?? r.id;
}
