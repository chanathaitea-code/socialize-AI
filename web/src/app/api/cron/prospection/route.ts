import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpenAgendaProvider, classifyEvent } from "@/modules/prospection/providers/evenements";
import { EntreprisesGouvProvider } from "@/modules/prospection/providers/entreprises";
import { planScan } from "@/modules/prospection/scan/planner";
import { bandsAbove } from "@/modules/prospection/geo/france";
import { computeScore, haversineKm } from "@/modules/prospection/scoring";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Veille permanente de la prospection — une exécution par nuit.
 *
 * Trois traitements, par ordre de priorité : échéances (le moins coûteux et le
 * plus important), événements (OpenAgenda), entreprises (API Recherche
 * d'entreprises). Chaque source avance derrière un curseur : une fonction
 * Vercel ne vit qu'une minute, donc on traite un lot borné par le temps
 * restant, on écrit où on s'est arrêté, et le lendemain reprend là.
 *
 * La veille lit et enregistre. Elle n'envoie rien : aucun email, aucun contact.
 */

/** Marge sous maxDuration : on sort proprement avant d'être coupé. */
const TIME_BUDGET_MS = 45_000;
/** Bornes par passage, pour rester lent mais jamais illimité. */
const EVENT_FETCH = 50;
const COMPANY_CELLS_PER_RUN = 4;
const COMPANY_PAGES_PER_CELL = 2;
const COMPANY_PER_PAGE = 25;

const WATCHED_DEFAULT = ["75", "77", "78", "91", "92", "93", "94", "95"];

interface RunCounters {
  cells_processed: number;
  found: number;
  created: number;
  duplicates: number;
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function logRun(
  supabase: SupabaseClient,
  brandId: string,
  source: string,
  startedAt: string,
  counters: RunCounters,
  error: string | null,
) {
  await supabase.from("veille_runs").insert({
    brand_id: brandId,
    source,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    cells_processed: counters.cells_processed,
    found: counters.found,
    created: counters.created,
    duplicates: counters.duplicates,
    error,
  });
}

async function readCursor(
  supabase: SupabaseClient,
  brandId: string,
  source: string,
  scopeKey: string,
): Promise<{ last_index: number; total_cells: number }> {
  const { data } = await supabase
    .from("veille_cursors")
    .select("last_index, total_cells")
    .eq("brand_id", brandId)
    .eq("source", source)
    .eq("scope_key", scopeKey)
    .maybeSingle();
  return {
    last_index: data?.last_index ?? 0,
    total_cells: data?.total_cells ?? 0,
  };
}

async function writeCursor(
  supabase: SupabaseClient,
  brandId: string,
  source: string,
  scopeKey: string,
  lastIndex: number,
  totalCells: number,
) {
  await supabase.from("veille_cursors").upsert(
    {
      brand_id: brandId,
      source,
      scope_key: scopeKey,
      last_index: lastIndex,
      total_cells: totalCells,
      last_run_at: new Date().toISOString(),
    },
    { onConflict: "brand_id,source,scope_key" },
  );
}

/** Renvoie les clés déjà présentes parmi les candidates, pour dédoublonner. */
async function existingKeys(
  supabase: SupabaseClient,
  brandId: string,
  keys: string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data } = await supabase
    .from("opportunities")
    .select("dedupe_key")
    .eq("brand_id", brandId)
    .in("dedupe_key", keys);
  return new Set((data ?? []).map((r) => r.dedupe_key as string));
}

// --- a. Échéances -----------------------------------------------------------

async function stepDeadlines(
  supabase: SupabaseClient,
  brandId: string,
  alertDays: number,
  journal: string[],
) {
  const started = new Date().toISOString();
  const today = todayISO();
  const horizon = addDays(today, alertDays);
  try {
    const { data, count } = await supabase
      .from("opportunities")
      .select("id", { count: "exact" })
      .eq("brand_id", brandId)
      .not("application_deadline", "is", null)
      .gte("application_deadline", today)
      .lte("application_deadline", horizon)
      .not("status", "in", "(won,lost)");
    const found = count ?? data?.length ?? 0;
    await logRun(
      supabase,
      brandId,
      "deadlines",
      started,
      { cells_processed: 1, found, created: 0, duplicates: 0 },
      null,
    );
    journal.push(`échéances ${brandId} : ${found} dans ${alertDays} j`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec échéances";
    await logRun(supabase, brandId, "deadlines", started,
      { cells_processed: 0, found: 0, created: 0, duplicates: 0 }, msg);
    journal.push(`échéances ${brandId} : ${msg}`);
  }
}

// --- b. Événements ----------------------------------------------------------

async function stepEvents(
  supabase: SupabaseClient,
  brandId: string,
  watched: string[],
  journal: string[],
) {
  const started = new Date().toISOString();
  const scopeKey = "watched";
  const provider = new OpenAgendaProvider();
  const counters: RunCounters = { cells_processed: 0, found: 0, created: 0, duplicates: 0 };
  try {
    const cursor = await readCursor(supabase, brandId, "openagenda", scopeKey);
    const page = await provider.search({
      departmentCodes: watched,
      fromDate: todayISO(),
      limit: EVENT_FETCH,
      offset: cursor.last_index,
    });
    counters.found = page.results.length;

    // Tri des formats à l'ingestion : on n'insère que les événements publics,
    // sur place, d'au moins une demi-journée, hors formats de salle.
    const kept = page.results.filter((ev) => classifyEvent(ev) === null);
    const rejected = page.results.length - kept.length;

    const candidates = kept
      .map((ev) => {
        const year = (ev.startsOn ?? ev.endsOn ?? todayISO()).slice(0, 4);
        return { ev, key: `openagenda:${ev.sourceId}:${year}` };
      })
      .filter((c, i, arr) => arr.findIndex((x) => x.key === c.key) === i);

    const already = await existingKeys(supabase, brandId, candidates.map((c) => c.key));
    const fresh = candidates.filter((c) => !already.has(c.key));
    counters.duplicates = candidates.length - fresh.length;

    if (fresh.length > 0) {
      const rows = fresh.map(({ ev, key }) => ({
        brand_id: brandId,
        family: "dated_event",
        name: ev.title,
        address: ev.address,
        city: ev.city,
        postal_code: ev.postalCode,
        lat: ev.lat,
        lng: ev.lng,
        starts_on: ev.startsOn,
        ends_on: ev.endsOn,
        organizer: ev.organizer,
        contact_name: ev.contactName,
        contact_email: ev.contactEmail,
        contact_phone: ev.contactPhone,
        source_url: ev.sourceUrl,
        notes: ev.description ? ev.description.slice(0, 500) : null,
        dedupe_key: key,
      }));
      const { error } = await supabase
        .from("opportunities")
        .upsert(rows, { onConflict: "brand_id,dedupe_key", ignoreDuplicates: true });
      if (error) throw error;
      counters.created = fresh.length;
    }

    // Avance le curseur ; s'il n'y a plus rien, on repart à zéro demain.
    const total = Math.max(page.total, cursor.total_cells);
    const nextIndex =
      page.results.length < EVENT_FETCH ? 0 : cursor.last_index + page.results.length;
    counters.cells_processed = 1;
    await writeCursor(supabase, brandId, "openagenda", scopeKey, nextIndex, total);
    await logRun(supabase, brandId, "openagenda", started, counters, null);
    journal.push(
      `événements ${brandId} : ${counters.created} nouveaux, ${counters.duplicates} doublons, ${rejected} hors critères`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec événements";
    await logRun(supabase, brandId, "openagenda", started, counters, msg);
    journal.push(`événements ${brandId} : ${msg}`);
  }
}

// --- c. Entreprises ---------------------------------------------------------

async function stepCompanies(
  supabase: SupabaseClient,
  brandId: string,
  watched: string[],
  minHeadcount: number,
  base: { lat: number; lng: number } | null,
  radiusKm: number,
  deadlineMs: number,
  journal: string[],
) {
  const started = new Date().toISOString();
  const scopeKey = "watched:" + watched.join(",");
  const provider = new EntreprisesGouvProvider();
  const bands = bandsAbove(minHeadcount);
  const counters: RunCounters = { cells_processed: 0, found: 0, created: 0, duplicates: 0 };

  try {
    const plan = planScan({ kind: "departments", codes: watched }, { minHeadcount });
    const cells = plan.cells;
    if (cells.length === 0) {
      await logRun(supabase, brandId, "entreprises", started, counters, null);
      return;
    }
    const cursor = await readCursor(supabase, brandId, "entreprises", scopeKey);
    let index = cursor.last_index % cells.length;

    const collected: import("@/modules/prospection/providers/entreprises").CompanyRecord[] = [];
    for (let n = 0; n < COMPANY_CELLS_PER_RUN; n++) {
      if (Date.now() > deadlineMs) break;
      const cell = cells[index];
      // L'identifiant de cellule est `${code}-${section}` : on cible la section.
      const section = cell.id.split("-")[1];
      for (let page = 1; page <= COMPANY_PAGES_PER_CELL; page++) {
        if (Date.now() > deadlineMs) break;
        const res = await provider.search({
          department: cell.department,
          nafSections: section ? [section] : undefined,
          headcountBands: bands,
          page,
          perPage: COMPANY_PER_PAGE,
        });
        collected.push(...res.results);
        if (page >= res.totalPages || res.results.length === 0) break;
      }
      counters.cells_processed++;
      index = (index + 1) % cells.length;
    }

    // Dédoublonnage sur le SIRET.
    const withSiret = collected.filter((c) => c.siret);
    counters.found = withSiret.length;
    const uniq = new Map<string, (typeof withSiret)[number]>();
    for (const c of withSiret) if (!uniq.has(c.siret!)) uniq.set(c.siret!, c);

    const keys = [...uniq.keys()].map((s) => `siret:${s}`);
    const already = await existingKeys(supabase, brandId, keys);
    const fresh = [...uniq.values()].filter((c) => !already.has(`siret:${c.siret}`));
    counters.duplicates = uniq.size - fresh.length;

    if (fresh.length > 0) {
      // Fiches entreprises (upsert sur brand_id, siret) pour récupérer les id.
      const companyRows = fresh.map((c) => ({
        brand_id: brandId,
        siren: c.siren,
        siret: c.siret,
        legal_name: c.name,
        naf_code: c.nafCode,
        headcount_band: c.headcountBand,
        headcount_estimate: c.headcountEstimate,
        created_on: c.createdOn,
        address: c.address,
        postal_code: c.postalCode,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
      }));
      const { data: companies, error: cErr } = await supabase
        .from("prospect_companies")
        .upsert(companyRows, { onConflict: "brand_id,siret" })
        .select("id, siret");
      if (cErr) throw cErr;
      const idBySiret = new Map((companies ?? []).map((r) => [r.siret as string, r.id as string]));

      const oppRows = fresh.map((c) => {
        const distanceKm =
          base && c.lat != null && c.lng != null
            ? Math.round(haversineKm(base, { lat: c.lat, lng: c.lng }) * 10) / 10
            : null;
        const result = computeScore({
          headcount: c.headcountEstimate,
          distanceKm,
          radiusKm,
        });
        return {
          brand_id: brandId,
          family: "daily_flow",
          name: c.name,
          address: c.address,
          city: c.city,
          postal_code: c.postalCode,
          lat: c.lat,
          lng: c.lng,
          distance_km: distanceKm,
          company_id: idBySiret.get(c.siret!) ?? null,
          score: result.score,
          tier: result.tier,
          dedupe_key: `siret:${c.siret}`,
        };
      });
      const { error: oErr } = await supabase
        .from("opportunities")
        .upsert(oppRows, { onConflict: "brand_id,dedupe_key", ignoreDuplicates: true });
      if (oErr) throw oErr;
      counters.created = fresh.length;
    }

    await writeCursor(supabase, brandId, "entreprises", scopeKey, index, cells.length);
    await logRun(supabase, brandId, "entreprises", started, counters, null);
    journal.push(
      `entreprises ${brandId} : ${counters.created} nouveaux sur ${counters.cells_processed} cellules, ${counters.duplicates} doublons`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec entreprises";
    await logRun(supabase, brandId, "entreprises", started, counters, msg);
    journal.push(`entreprises ${brandId} : ${msg}`);
  }
}

export async function GET(req: NextRequest) {
  // Même reconnaissance de l'appel planifié que api/cron/stories.
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
  const deadlineMs = Date.now() + TIME_BUDGET_MS;

  // Marques dont l'organisation a le module prospection actif.
  const { data: orgRows } = await supabase
    .from("organization_modules")
    .select("organization_id")
    .eq("module", "prospection")
    .eq("enabled", true);
  const orgIds = [...new Set((orgRows ?? []).map((r) => r.organization_id as string))];
  if (orgIds.length === 0) return NextResponse.json({ ok: true, actions: ["aucune organisation avec prospection"] });

  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .in("organization_id", orgIds);

  for (const b of brands ?? []) {
    if (Date.now() > deadlineMs) {
      journal.push("budget de temps atteint, reprise demain");
      break;
    }
    const brandId = b.id as string;

    const { data: settings } = await supabase
      .from("prospection_settings")
      .select(
        "watched_departments, event_radius_km, veille_enabled, deadline_alert_days, base_lat, base_lng, radius_km, min_headcount",
      )
      .eq("brand_id", brandId)
      .maybeSingle();

    if (settings && settings.veille_enabled === false) {
      journal.push(`veille coupée pour ${brandId}`);
      continue;
    }

    const watched =
      (settings?.watched_departments as string[] | null)?.length
        ? (settings!.watched_departments as string[])
        : WATCHED_DEFAULT;
    const alertDays = (settings?.deadline_alert_days as number | null) ?? 15;
    const minHeadcount = (settings?.min_headcount as number | null) ?? 100;
    const radiusKm = (settings?.radius_km as number | null) ?? 25;
    const base =
      settings?.base_lat != null && settings?.base_lng != null
        ? { lat: settings.base_lat as number, lng: settings.base_lng as number }
        : null;

    // Ordre de priorité : échéances, puis événements, puis entreprises.
    await stepDeadlines(supabase, brandId, alertDays, journal);
    if (Date.now() <= deadlineMs) await stepEvents(supabase, brandId, watched, journal);
    if (Date.now() <= deadlineMs)
      await stepCompanies(supabase, brandId, watched, minHeadcount, base, radiusKm, deadlineMs, journal);
  }

  return NextResponse.json({ ok: true, actions: journal });
}
