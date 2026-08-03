import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clampWeek, iso, libellePeriode, mondayOf } from "@/lib/semaine";
import { THEMES, lignesSemaine, type Slot } from "@/lib/story";
import { STORY_H, STORY_L, storyImageElement } from "@/lib/story-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const theme = THEMES[sp.get("theme") ?? "vert"] ?? THEMES.vert;
  const fond = sp.get("fond");
  const media = sp.get("media");
  const w = clampWeek(sp.get("w") ?? (sp.get("s") === "next" ? "1" : "0"));

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Connexion requise", { status: 401 });

  const monday = mondayOf(w);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const { data } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .gte("day", iso(monday))
    .lte("day", iso(sunday))
    .order("day")
    .order("service");

  const lignes = lignesSemaine((data ?? []) as Slot[], monday);
  const photoUrl = media ? supabase.storage.from("media").getPublicUrl(media).data.publicUrl : null;

  const [regular, extrabold] = await Promise.all([
    fetch(new URL("/fonts/inter-regular.ttf", req.nextUrl.origin)).then((r) => r.arrayBuffer()),
    fetch(new URL("/fonts/inter-extrabold.ttf", req.nextUrl.origin)).then((r) => r.arrayBuffer()),
  ]);

  const image = new ImageResponse(
    storyImageElement({ theme, lignes, periode: libellePeriode(monday), photoUrl, fond }),
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
}
