import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { chargerThemes } from "@/lib/design";
import { identite } from "@/lib/marque";
import { STORY_H, STORY_L } from "@/lib/story-image";
import { gabaritElement, type Gabarit } from "@/lib/gabarits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function police(nom: string, req: NextRequest): Promise<ArrayBuffer> {
  try {
    const buf = await readFile(join(process.cwd(), "public", "fonts", nom));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    const r = await fetch(new URL(`/fonts/${nom}`, req.nextUrl.origin));
    if (!r.ok) throw new Error(`police ${nom} illisible (${r.status})`);
    return r.arrayBuffer();
  }
}

/** Aperçu et téléchargement des gabarits : tout passe par l'adresse. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const gabarit = (sp.get("g") ?? "plat") as Gabarit;
    const media = sp.get("media");

    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Connexion requise", { status: 401 });

    const tous = await chargerThemes(supabase);
    const theme = tous[sp.get("theme") ?? "vert"] ?? tous.vert;

    const photoUrl = media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null;
    const champs = {
      identite: await identite(supabase),
      titre: sp.get("titre") ?? undefined,
      sous: sp.get("sous") ?? undefined,
      prix: sp.get("prix") ?? undefined,
      texte: sp.get("texte") ?? undefined,
      auteur: sp.get("auteur") ?? undefined,
      lieu: sp.get("lieu") ?? undefined,
      photoUrl,
    };

    const [regular, extrabold] = await Promise.all([
      police("inter-regular.ttf", req),
      police("inter-extrabold.ttf", req),
    ]);

    const image = new ImageResponse(gabaritElement(gabarit, theme, champs), {
      width: STORY_L,
      height: STORY_H,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: extrabold, weight: 800, style: "normal" },
      ],
    });

    const entetes = new Headers(image.headers);
    if (sp.get("dl")) entetes.set("Content-Disposition", `attachment; filename="story-${gabarit}.png"`);
    entetes.set("Cache-Control", "no-store");
    return new Response(image.body, { status: 200, headers: entetes });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    return new Response(`Génération de l'image impossible : ${detail}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
