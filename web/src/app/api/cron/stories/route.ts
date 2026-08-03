import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { iso, mondayOf } from "@/lib/semaine";
import { publierLaStory } from "@/lib/publish";
import { rafraichirMesures } from "@/lib/insights";
import { publierMedia } from "@/lib/publier-media";
import { dechiffrer } from "@/lib/crypto";
import { publierLaJournee } from "@/lib/publier-jour";
import { construireRapport, premierDuMois } from "@/lib/rapport";

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
  // Reconnaître l'appel planifié de Vercel : selon les versions il porte
  // l'en-tête x-vercel-cron, ou seulement son agent, ou le secret partagé.
  const secret = process.env.CRON_SECRET;
  const agent = (req.headers.get("user-agent") ?? "").toLowerCase();
  const autorise =
    req.headers.get("x-vercel-cron") !== null ||
    agent.includes("vercel-cron") ||
    (!!secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!autorise) {
    return NextResponse.json({ erreur: "non autorisé", agent }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const journal: string[] = [];

  // Pause générale : on ne publie rien, les envois restent en attente
  const { data: reglages0 } = await supabase.from("automation_settings").select("brand_id, mode");
  const enPause = new Set((reglages0 ?? []).filter((r) => r.mode === "paused").map((r) => r.brand_id));

  // 1. Rendez-vous hebdomadaire : créer l'envoi de la semaine suivante
  const { jour, heure } = maintenantParis();
  const { data: reglages } = await supabase.from("story_auto").select("*").eq("enabled", true);
  for (const r of reglages ?? []) {
    if (enPause.has(r.brand_id)) continue;
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

  // 1 bis. Story du matin : « on est là aujourd'hui », les jours de service
  for (const r of reglages ?? []) {
    if (!r.jour_enabled || enPause.has(r.brand_id)) continue;
    if ((r.jour_hour_paris ?? 9) !== heure) continue;
    const cejour = mondayOf(0);
    const today = new Date();
    const aujourdhui = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(today);
    void cejour;
    if (r.jour_last_run === aujourdhui) continue;

    const { data: services } = await supabase
      .from("location_schedule")
      .select("id, status")
      .eq("brand_id", r.brand_id)
      .eq("day", aujourdhui)
      .neq("status", "cancelled");
    // Pas de service aujourd'hui : on ne raconte pas le repos tous les jours
    await supabase.from("story_auto").update({ jour_last_run: aujourdhui }).eq("brand_id", r.brand_id);
    if (!services?.length) {
      journal.push(`story du matin ignorée pour ${r.brand_id} : pas de service`);
      continue;
    }

    const { data: photo } = await supabase
      .from("media_assets")
      .select("storage_path")
      .eq("brand_id", r.brand_id)
      .eq("kind", "photo")
      .order("created_at", { ascending: false })
      .limit(1);

    try {
      const resultats = await publierLaJournee(supabase, {
        brandId: r.brand_id,
        jour: new Date(aujourdhui + "T00:00:00Z"),
        theme: r.theme ?? "vert",
        mediaPath: photo?.[0]?.storage_path ?? null,
        cibles: r.jour_targets ?? ["instagram"],
      });
      journal.push(`story du matin : ${resultats.map((x) => `${x.platform} ${x.status}`).join(", ")}`);
    } catch (e) {
      journal.push(`story du matin en échec : ${e instanceof Error ? e.message : "erreur"}`);
    }
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
    if (enPause.has(job.brand_id)) {
      journal.push(`${job.id} : en attente, tout est en pause`);
      continue;
    }
    try {
      const legende = job.caption ?? "";
      const resultats =
        job.kind === "photo" && job.media_path
          ? await publierMedia(supabase, {
              brandId: job.brand_id,
              mediaPath: job.media_path,
              legende,
              cibles: job.targets ?? [],
              format: job.format ?? "post",
            })
          : await publierLaStory(supabase, {
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

  // 3. Statistiques des publications récentes
  const { data: marques } = await supabase.from("brands").select("id").limit(20);
  for (const m of marques ?? []) {
    try {
      const n = await rafraichirMesures(supabase, m.id, 3);
      if (n) journal.push(`${n} statistique(s) relevée(s)`);
    } catch {
      // un relevé raté n'empêche pas le reste
    }
  }

  // 3 bis. Rapport mensuel, le 1er du mois à 9h
  const dateParis = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (dateParis.endsWith("-01") && heure === 9) {
    const moisPrecedent = premierDuMois(-1);
    const cle = moisPrecedent.toISOString().slice(0, 10);
    const { data: marquesR } = await supabase.from("brands").select("id").limit(20);
    for (const m of marquesR ?? []) {
      const { data: deja } = await supabase
        .from("monthly_reports")
        .select("id")
        .eq("brand_id", m.id)
        .eq("mois", cle)
        .maybeSingle();
      if (deja) continue;
      try {
        const rapport = await construireRapport(supabase, m.id, moisPrecedent);
        await supabase.from("monthly_reports").upsert(
          { brand_id: m.id, mois: cle, contenu: rapport },
          { onConflict: "brand_id,mois" }
        );
        journal.push(`rapport ${rapport.intitule} établi`);
      } catch (e) {
        journal.push(`rapport en échec : ${e instanceof Error ? e.message : "erreur"}`);
      }
    }
  }

  // 4. Santé des comptes : un jeton révoqué doit se voir avant la prochaine publication
  const { data: tousComptes } = await supabase
    .from("social_accounts")
    .select("id, platform, external_id, encrypted_credentials, status");
  for (const c of tousComptes ?? []) {
    try {
      const jeton = dechiffrer(String(c.encrypted_credentials));
      const r = await fetch(
        `https://graph.facebook.com/v23.0/${c.external_id}?fields=id&access_token=${encodeURIComponent(jeton)}`,
        { cache: "no-store" }
      );
      const ok = r.ok && !(await r.json()).error;
      const statut = ok ? "connected" : "error";
      if (statut !== c.status) journal.push(`${c.platform} : ${statut}`);
      await supabase
        .from("social_accounts")
        .update({ status: statut, last_health_check: new Date().toISOString() })
        .eq("id", c.id);
    } catch {
      await supabase
        .from("social_accounts")
        .update({ status: "error", last_health_check: new Date().toISOString() })
        .eq("id", c.id);
    }
  }

  return NextResponse.json({ ok: true, actions: journal });
}
