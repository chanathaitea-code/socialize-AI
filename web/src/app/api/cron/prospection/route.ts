import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OpenAgendaProvider, classifyEvent } from "@/modules/prospection/providers/evenements";
import { EntreprisesGouvProvider } from "@/modules/prospection/providers/entreprises";
import { ServicePublicAnnuaire, type MairieContact } from "@/modules/prospection/providers/annuaire";
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
// Plafond de l'API opendatasoft (100/requête). Un fetch répond en ~200 ms :
// le vrai garde-fou est le budget de temps, pas ce nombre.
const EVENT_FETCH = 100;
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
  deadlineMs: number,
  journal: string[],
): Promise<{ wrapped: boolean }> {
  const started = new Date().toISOString();
  const scopeKey = "watched";
  const provider = new OpenAgendaProvider();
  const annuaire = new ServicePublicAnnuaire();
  const mairieCache = new Map<string, MairieContact | null>();
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
    // sur place, d'au moins trois heures, hors formats de salle. Une durée
    // inconnue est retenue (et marquée plus bas), pas écartée.
    const kept = page.results.filter((ev) => classifyEvent(ev) === null);
    const rejected = page.results.length - kept.length;
    const unknownDuration = kept.filter((ev) => ev.durationHours == null).length;

    const candidates = kept
      .map((ev) => {
        const year = (ev.startsOn ?? ev.endsOn ?? todayISO()).slice(0, 4);
        return { ev, key: `openagenda:${ev.sourceId}:${year}` };
      })
      .filter((c, i, arr) => arr.findIndex((x) => x.key === c.key) === i);

    const already = await existingKeys(supabase, brandId, candidates.map((c) => c.key));
    const fresh = candidates.filter((c) => !already.has(c.key));
    counters.duplicates = candidates.length - fresh.length;

    let enriched = 0;
    let enrichAttempted = 0;
    let budgetSkipped = 0;
    let lastLookupNote = "";

    if (fresh.length > 0) {
      // Enrichissement des contacts par l'annuaire des mairies, quand
      // l'organisateur n'a pas laissé de coordonnées. Contact de la mairie,
      // donc confiance « estimated » (tracée dans data_sources_log), jamais
      // présenté comme le contact direct de l'organisateur.
      // INSEE d'abord ; repli sur commune + code postal quand il manque (≈10 %
      // des événements, souvent les petites communes, les plus intéressantes).
      async function mairieFor(ev: {
        insee: string | null;
        city: string | null;
        postalCode: string | null;
      }): Promise<MairieContact | null> {
        const key = ev.insee || (ev.postalCode ? `cp:${ev.postalCode}:${ev.city ?? ""}` : null);
        if (!key) return null;
        if (mairieCache.has(key)) return mairieCache.get(key)!;
        let r: MairieContact | null = null;
        try {
          r = ev.insee
            ? await annuaire.lookupByInsee(ev.insee)
            : await annuaire.lookupByCommune(ev.city, ev.postalCode);
        } catch {
          r = null;
        }
        mairieCache.set(key, r);
        return r;
      }

      const prepared: Array<{
        key: string;
        row: Record<string, unknown>;
        estimatedFields: string[];
      }> = [];

      for (const { ev, key } of fresh) {
        let email = ev.contactEmail;
        let phone = ev.contactPhone;
        const estimatedFields: string[] = [];
        const canLookup = ev.insee || ev.postalCode;
        if ((!email || !phone) && canLookup) {
          if (Date.now() < deadlineMs) {
            enrichAttempted++;
            const m = await mairieFor({ insee: ev.insee, city: ev.city, postalCode: ev.postalCode });
            lastLookupNote = annuaire.lastStatus;
            if (m) {
              if (!email && m.email) { email = m.email; estimatedFields.push("contact_email"); }
              if (!phone && m.phone) { phone = m.phone; estimatedFields.push("contact_phone"); }
            }
          } else {
            budgetSkipped++;
          }
        }
        if (estimatedFields.length) enriched++;
        prepared.push({
          key,
          estimatedFields,
          row: {
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
            contact_email: email,
            contact_phone: phone,
            source_url: ev.sourceUrl,
            // Durée inconnue : on retient mais on marque, pour que ces événements
            // (souvent ceux des petites communes) restent identifiables en base.
            notes:
              (ev.durationHours == null ? "[duree_inconnue] " : "") +
                (ev.description ? ev.description.slice(0, 500) : "") || null,
            dedupe_key: key,
          },
        });
      }

      const { data: inserted, error } = await supabase
        .from("opportunities")
        .upsert(prepared.map((p) => p.row), {
          onConflict: "brand_id,dedupe_key",
          ignoreDuplicates: true,
        })
        .select("id, dedupe_key");
      if (error) throw error;
      counters.created = inserted?.length ?? 0;

      // Traçabilité de la provenance des contacts enrichis.
      const idByKey = new Map(
        (inserted ?? []).map((r) => [r.dedupe_key as string, r.id as string]),
      );
      const logs = prepared.flatMap((p) => {
        const id = idByKey.get(p.key);
        if (!id) return [];
        return p.estimatedFields.map((f) => ({
          brand_id: brandId,
          entity_type: "opportunity",
          entity_id: id,
          field_name: f,
          source: annuaire.name,
          confidence: "estimated",
        }));
      });
      if (logs.length) await supabase.from("data_sources_log").insert(logs);
    }

    // Avance le curseur ; s'il n'y a plus rien, on repart à zéro demain.
    const total = Math.max(page.total, cursor.total_cells);
    const nextIndex =
      page.results.length < EVENT_FETCH ? 0 : cursor.last_index + page.results.length;
    counters.cells_processed = 1;
    // Diagnostic d'enrichissement, écrit dans veille_runs.error (préfixé "diag:")
    // pour être lisible sans redéploiement : distingue "budget" de "annuaire KO".
    let diag: string | null = null;
    if (fresh.length > 0 && enriched === 0) {
      diag =
        enrichAttempted === 0
          ? `diag: enrichissement non tenté (${budgetSkipped} reportés budget, ${fresh.length - budgetSkipped} sans commune)`
          : `diag: enrichi 0/${enrichAttempted} — annuaire: ${lastLookupNote || "?"}`;
    }
    await writeCursor(supabase, brandId, "openagenda", scopeKey, nextIndex, total);
    await logRun(supabase, brandId, "openagenda", started, counters, diag);
    journal.push(
      `événements ${brandId} : ${counters.created} nouveaux (dont ${unknownDuration} durée inconnue, ${enriched} enrichis mairie), ${counters.duplicates} doublons, ${rejected} hors critères`,
    );
    return { wrapped: nextIndex === 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec événements";
    await logRun(supabase, brandId, "openagenda", started, counters, msg);
    journal.push(`événements ${brandId} : ${msg}`);
    // En cas d'erreur, on arrête la boucle de backfill plutôt que de tourner à vide.
    return { wrapped: true };
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

  // ?task=backfill : récupération initiale. On enchaîne les passages
  // d'événements dans le budget de 45 s, en avançant le curseur, jusqu'à ce
  // qu'il boucle. L'appelant relance tant que "done" est faux.
  const task = new URL(req.url).searchParams.get("task");
  const backfill = task === "backfill";
  let allWrapped = true;

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
      if (backfill) allWrapped = false; // marques restantes non traitées
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

    if (backfill) {
      // Récupération initiale : on n'enchaîne que les événements, jusqu'au
      // bouclage du curseur ou l'épuisement du budget de temps.
      let passes = 0;
      let wrapped = false;
      while (Date.now() < deadlineMs) {
        const res = await stepEvents(supabase, brandId, watched, deadlineMs, journal);
        passes++;
        if (res.wrapped) {
          wrapped = true;
          break;
        }
      }
      if (!wrapped) allWrapped = false;
      journal.push(
        `backfill ${brandId} : ${passes} passage(s), ${wrapped ? "terminé (curseur bouclé)" : "à poursuivre"}`,
      );
      continue;
    }

    // Ordre de priorité : échéances, puis événements, puis entreprises.
    await stepDeadlines(supabase, brandId, alertDays, journal);
    if (Date.now() <= deadlineMs) await stepEvents(supabase, brandId, watched, deadlineMs, journal);
    if (Date.now() <= deadlineMs)
      await stepCompanies(supabase, brandId, watched, minHeadcount, base, radiusKm, deadlineMs, journal);
  }

  if (backfill) {
    return NextResponse.json({ ok: true, mode: "backfill", done: allWrapped, actions: journal });
  }
  return NextResponse.json({ ok: true, actions: journal });
}
