import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import { lignesSemaine, type Slot } from "@/lib/story";
import { chargerThemes } from "@/lib/design";
import { identite } from "@/lib/marque";
import { STORY_H, STORY_L, storyImageElement } from "@/lib/story-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Les polices sont lues sur le disque de la fonction. Les récupérer par HTTP
 * depuis l'application elle-même échoue dès que le déploiement est protégé :
 * la requête interne reçoit la page de connexion de l'hébergeur au lieu du
 * fichier. La lecture disque reste le chemin sûr, le fetch n'est qu'un secours.
 */
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

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const fond = sp.get("fond");
    const media = sp.get("media");
    const w = clampWeek(sp.get("w") ?? (sp.get("s") === "next" ? "1" : "0"));

    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Connexion requise", { status: 401 });

    const tous = await chargerThemes(supabase);
    const theme = tous[sp.get("theme") ?? "vert"] ?? tous.vert;

    const monday = mondayOf(w);
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);

    const { data } = await supabase
      .from("location_schedule")
      .select("day, service, time_range, note, status")
      .gte("day", iso(monday))
      .lte("day", iso(sunday))
      .order("day")
      .order("service");

    const lignes = lignesSemaine((data ?? []) as Slot[], monday);
    const photoUrl = media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null;

    const [regular, extrabold] = await Promise.all([
      police("inter-regular.ttf", req),
      police("inter-extrabold.ttf", req),
    ]);

    const image = new ImageResponse(
      storyImageElement({
        theme,
        lignes,
        periode: libellePeriode(monday),
        photoUrl,
        fond,
        identite: await identite(supabase),
      }),
      {
        width: STORY_L,
        height: STORY_H,
        fonts: [
          { name: "Inter", data: regular, weight: 400, style: "normal" },
          { name: "Inter", data: extrabold, weight: 800, style: "normal" },
        ],
      }
    );

    const entetes = new Headers(image.headers);
    entetes.set("Content-Disposition", `attachment; filename="story-chana-thai-${iso(monday)}.png"`);
    entetes.set("Cache-Control", "no-store");
    return new Response(image.body, { status: 200, headers: entetes });
  } catch (e) {
    // Message lisible plutôt qu'une page d'erreur muette
    const detail = e instanceof Error ? e.message : "erreur inconnue";
    return new Response(`Génération de l'image impossible : ${detail}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
