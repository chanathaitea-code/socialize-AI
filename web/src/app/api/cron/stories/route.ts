import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { iso, mondayOf } from "@/lib/semaine";
import { publierLaStory } from "@/lib/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Heure de Paris sans dépendance externe : UTC+2 en été, UTC+1 en hiver. */
function maintenantParis(): { jour: number; heure: number } {
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(new Date());
  const heure = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const jours = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const court = (parts.find((p) => p.type === "weekday")?.value ?? "").slice(0, 3).toLowerCase();
  const index = jours.indexOf(court); // 0 = dimanche
  const jour = index <= 0 ? 7 : index; // 1 = lundi ... 7 = dimanche
  return { jour, heure };
}

export async function GET(req: NextRequest) {
  // Vercel signe ses appels planifiés ; en dehors, on exige le secret
  const secret = process.env.CRON_SECRET;
  const autorise =
    req.headers.get("x-vercel-cron") !== null ||
    (secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!autorise) return new NextResponse("non autorisé", { status: 401 });

  const supabase = supabaseAdmin();
  const journal: string[] = [];

  // 1. Rendez-vous hebdomadaire : créer l'envoi de la semaine suivante
  const { jour, heure } = maintenantParis();
  const { data: reglages } = await supabase.from("story_auto").select("*").eq("enabled", true);
  for (const r of reglages ?? []) {
    if (r.weekday !== jour || r.hour_paris !== heure) continue;
    const cible = mondayOf(1); // la story annonce la semaine à venir
    if (r.last_run_week === iso(cible)) continue; // déjà programmé cette semaine

    const { data: media } = await supabase
      .from("media_assets")
      .select("storage_path")
      .eq("brand_id", r.brand_id)
      .eq("kind", "photo")
      .order("created_at", { ascending: false })
      .limit(1);

    await supabase.from("story_jobs").insert({
      brand_id: r.brand_id,
      run_at: new Date(Date.now() + (r.grace_minutes ?? 15) * 60_000).toISOString(),
      monday: iso(cible),
      theme: r.theme ?? "vert",
      media_path: media?.[0]?.storage_path ?? null,
      caption: null,
      targets: r.targets ?? ["instagram", "facebook"],
      origin: "hebdo",
    });
    await supabase.from("story_auto").update({ last_run_week: iso(cible) }).eq("brand_id", r.brand_id);
    journal.push(`rendez-vous hebdomadaire programmé pour ${r.brand_id}`);
  }

  // 2. Envois arrivés à échéance
  const { data: jobs } = await supabase
    .from("story_jobs")
    .select("*")
    .eq("status", "scheduled")
    .lte("run_at", new Date().toISOString())
    .order("run_at")
    .limit(5);

  for (const job of jobs ?? []) {
    try {
      const legende = job.caption ?? "";
      const resultats = await publierLaStory(supabase, {
        brandId: job.brand_id,
        monday: new Date(job.monday + "T00:00:00Z"),
        theme: job.theme,
        mediaPath: job.media_path,
        fond: job.fond,
        legende,
        cibles: job.targets ?? [],
      });
      const echecs = resultats.filter((r) => r.status === "failed");
      await supabase
        .from("story_jobs")
        .update({
          status: echecs.length ? "failed" : "published",
          error: echecs.length ? echecs.map((e) => `${e.platform} : ${e.error}`).join(" · ") : null,
          done_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      journal.push(`${job.id} : ${echecs.length ? "échec" : "publié"}`);
    } catch (e) {
      await supabase
        .from("story_jobs")
        .update({
          status: "failed",
          error: e instanceof Error ? e.message : "échec",
          done_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      journal.push(`${job.id} : erreur`);
    }
  }

  return NextResponse.json({ ok: true, actions: journal });
}
