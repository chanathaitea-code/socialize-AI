/**
 * Le pilote automatique : ce que l'application fait sans qu'on le lui demande.
 *
 * Toutes les règles fabriquent un envoi programmé plutôt qu'une publication
 * immédiate. Le délai — une demi-heure par défaut — laisse le temps de couper
 * depuis le Journal. Rien ici ne publie directement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rendreElement } from "./story-render";
import { gabaritElement, legendeGabarit, type ChampsGabarit, type Gabarit } from "./gabarits";
import { unTheme } from "./design";
import { iso, mondayOf, JOURS } from "./semaine";
import { premierDuMois } from "./rapport";
import { enregistrerPlan } from "./ligne";

const GABARITS_AUTO = new Set(["plat", "avis", "coulisses"]);

export type InstantParis = { date: string; heure: number; minute: number; jour: number };

/** L'instant présent à Paris, découpé en morceaux utilisables. */
export function maintenantParis(): InstantParis {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  const jours = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const index = jours.indexOf(String(p.weekday ?? "").slice(0, 3).toLowerCase());
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    heure: Number(p.hour) % 24,
    minute: Number(p.minute),
    jour: index <= 0 ? 7 : index, // 1 = lundi … 7 = dimanche
  };
}

/** « 11h30-14h00 », « 11:30 - 14h » : on ne retient que l'heure de début. */
function debutService(plage: string | null): { h: number; m: number } | null {
  const m = String(plage ?? "").match(/(\d{1,2})\s*[h:]\s*(\d{2})?/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2] ?? 0) };
}

/** L'instant UTC correspondant à une heure de Paris, un jour donné. */
function instantParis(dateIso: string, h: number, m: number): Date {
  const naif = new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(naif).map((x) => [x.type, x.value]));
  const commeUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
  return new Date(naif.getTime() - (commeUtc - naif.getTime()));
}

/** Une règle ne doit se déclencher qu'une fois par occasion. */
async function dejaFait(supabase: SupabaseClient, brandId: string, cle: string): Promise<boolean> {
  const { data } = await supabase
    .from("auto_runs")
    .select("id")
    .eq("brand_id", brandId)
    .eq("cle", cle)
    .maybeSingle();
  return !!data;
}

async function marquer(supabase: SupabaseClient, brandId: string, cle: string) {
  await supabase.from("auto_runs").insert({ brand_id: brandId, cle });
}

/** Fabrique le visuel, le dépose au stockage, et programme l'envoi. */
async function programmer(
  supabase: SupabaseClient,
  opts: {
    brandId: string;
    gabarit: Gabarit;
    champs: ChampsGabarit;
    themeCle: string;
    legende?: string;
    quand: Date;
    cibles: string[];
    origine: string;
  }
): Promise<string> {
  const { brandId, gabarit, champs, themeCle, quand, cibles, origine } = opts;
  const image = await rendreElement(gabaritElement(gabarit, await unTheme(supabase, brandId, themeCle), champs));
  const png = Buffer.from(await image.arrayBuffer());
  const chemin = `${brandId}/auto/${gabarit}-${Date.now()}.png`;
  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(chemin, png, { contentType: "image/png", upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from("story_jobs")
    .insert({
      brand_id: brandId,
      run_at: quand.toISOString(),
      monday: iso(mondayOf(0)),
      kind: "photo",
      format: "story",
      media_path: chemin,
      caption: opts.legende ?? legendeGabarit(gabarit, champs),
      targets: cibles,
      origin: origine,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.id ?? "");
}

/** La dernière photo envoyée, celle qui a le plus de chances d'être fraîche. */
async function dernierePhoto(supabase: SupabaseClient, brandId: string): Promise<string | null> {
  const { data } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("brand_id", brandId)
    .eq("kind", "photo")
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.storage_path as string) ?? null;
}

const urlPublique = (supabase: SupabaseClient, chemin: string | null) =>
  chemin ? supabase.storage.from("media").getPublicUrl(chemin).data.publicUrl : null;

const euros = (cents: number | null) =>
  cents ? `${(cents / 100).toFixed(2).replace(".", ",").replace(",00", "")} €` : "";

/** Le prochain service à venir, pour donner rendez-vous les jours de repos. */
async function prochainRendezVous(
  supabase: SupabaseClient,
  brandId: string,
  apres: string
): Promise<string | null> {
  const { data } = await supabase
    .from("location_schedule")
    .select("day, service, time_range, note")
    .eq("brand_id", brandId)
    .gt("day", apres)
    .neq("status", "cancelled")
    .order("day")
    .limit(1);
  const s = data?.[0];
  if (!s) return null;
  const d = new Date(`${s.day}T00:00:00Z`);
  const jour = JOURS[(d.getUTCDay() + 6) % 7];
  return `${jour} ${s.service === "soir" ? "soir" : "midi"} à ${s.note ?? ""}`.trim();
}

/**
 * Passe en revue toutes les règles, pour toutes les marques.
 * Retourne le journal de ce qui a été fait, affiché dans la réponse de la tâche.
 */
export async function pilote(supabase: SupabaseClient, enPause: Set<string>): Promise<string[]> {
  const journal: string[] = [];
  const now = maintenantParis();

  const { data: reglages } = await supabase.from("story_auto").select("*");
  for (const r of reglages ?? []) {
    const brandId = String(r.brand_id);
    if (enPause.has(brandId)) continue;
    const cibles: string[] = r.auto_targets ?? r.jour_targets ?? ["instagram"];
    const delai = Number(r.auto_grace ?? 30);
    const theme = String(r.theme ?? "vert");

    // 1. La ligne éditoriale du mois, le 1er à 8h
    if (r.ligne_auto && now.date.endsWith("-01") && now.heure === 8) {
      const mois = premierDuMois(0);
      const cle = `ligne:${iso(mois)}`;
      if (!(await dejaFait(supabase, brandId, cle))) {
        await marquer(supabase, brandId, cle);
        try {
          const { nombre } = await enregistrerPlan(supabase, brandId, mois);
          journal.push(`ligne éditoriale du mois établie : ${nombre} contenus`);
        } catch (e) {
          journal.push(`ligne éditoriale en échec : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }

    const { data: services } = await supabase
      .from("location_schedule")
      .select("id, service, time_range, note")
      .eq("brand_id", brandId)
      .eq("day", now.date)
      .neq("status", "cancelled")
      .order("service");
    const duJour = services ?? [];

    // 2. Le compte à rebours, une heure avant chaque service
    if (r.rebours_enabled) {
      for (const s of duJour) {
        const debut = debutService(s.time_range);
        if (!debut) continue;
        const depart = instantParis(now.date, debut.h, debut.m);
        const envoi = new Date(depart.getTime() - 60 * 60_000); // une heure avant
        const reste = (envoi.getTime() - Date.now()) / 60_000;
        // On prépare l'envoi assez tôt pour laisser le délai d'annulation
        if (reste < delai || reste > delai + 15) continue;
        const cle = `rebours:${now.date}:${s.id}`;
        if (await dejaFait(supabase, brandId, cle)) continue;
        await marquer(supabase, brandId, cle);
        try {
          await programmer(supabase, {
            brandId,
            gabarit: "rebours",
            themeCle: theme,
            champs: {
              titre: "DANS 1H",
              sous: s.service === "soir" ? "Le service du soir commence" : "Le service du midi commence",
              lieu: `${s.note ?? ""}${s.time_range ? ` · ${s.time_range}` : ""}`,
              photoUrl: urlPublique(supabase, await dernierePhoto(supabase, brandId)),
            },
            quand: envoi,
            cibles,
            origine: "auto-rebours",
          });
          journal.push(`compte à rebours programmé pour ${s.note ?? "un service"}`);
        } catch (e) {
          journal.push(`compte à rebours en échec : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }

    // 3. Le plat à l'honneur, les jours choisis
    const jours: number[] = r.plat_jours ?? [2, 5];
    if (r.plat_enabled && jours.includes(now.jour) && now.heure === Number(r.plat_heure ?? 11) && now.minute < 5) {
      const cle = `plat:${now.date}`;
      if (!(await dejaFait(supabase, brandId, cle))) {
        await marquer(supabase, brandId, cle);
        try {
          const { data: produits } = await supabase
            .from("products")
            .select("name, price_cents")
            .eq("brand_id", brandId)
            .eq("active", true)
            .eq("out_of_stock", false)
            .order("name");
          if (!produits?.length) {
            journal.push("plat à l'honneur ignoré : carte vide");
          } else {
            // On tourne sur la carte, semaine après semaine, sans répéter
            const semaine = Math.floor(Date.now() / (7 * 86_400_000));
            const p = produits[semaine % produits.length];
            await programmer(supabase, {
              brandId,
              gabarit: "plat",
              themeCle: theme,
              champs: {
                titre: String(p.name),
                prix: euros(p.price_cents as number | null),
                sous: "Préparé minute dans le wok, comme à Bangkok.",
                photoUrl: urlPublique(supabase, await dernierePhoto(supabase, brandId)),
              },
              quand: new Date(Date.now() + delai * 60_000),
              cibles,
              origine: "auto-plat",
            });
            journal.push(`plat à l'honneur programmé : ${p.name}`);
          }
        } catch (e) {
          journal.push(`plat à l'honneur en échec : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }

    // 4. Les jours sans service : donner envie et donner rendez-vous
    if (r.envie_enabled && duJour.length === 0 && now.heure === Number(r.envie_heure ?? 12) && now.minute < 5) {
      const cle = `envie:${now.date}`;
      if (!(await dejaFait(supabase, brandId, cle))) {
        await marquer(supabase, brandId, cle);
        try {
          const { data: produits } = await supabase
            .from("products")
            .select("name, price_cents")
            .eq("brand_id", brandId)
            .eq("active", true)
            .eq("out_of_stock", false)
            .order("name");
          const rdv = await prochainRendezVous(supabase, brandId, now.date);
          const p = produits?.length ? produits[Math.floor(Date.now() / 86_400_000) % produits.length] : null;
          const legende = `${p ? `${p.name} vous attend.` : "On recharge les woks."}${
            rdv ? `\n\n📍 On se retrouve ${rdv}.` : ""
          }\n\nÀ très vite 🍜`;
          await programmer(supabase, {
            brandId,
            gabarit: "plat",
            themeCle: theme,
            champs: {
              titre: p ? String(p.name) : "Le camion se repose",
              prix: p ? euros(p.price_cents as number | null) : "",
              sous: rdv ? `On se retrouve ${rdv}.` : "Le camion revient très vite.",
              photoUrl: urlPublique(supabase, await dernierePhoto(supabase, brandId)),
            },
            legende,
            quand: new Date(Date.now() + delai * 60_000),
            cibles,
            origine: "auto-envie",
          });
          journal.push("story d'un jour sans service programmée");
        } catch (e) {
          journal.push(`story sans service en échec : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }

    // 5. Les contenus du calendrier, préparés la veille au soir
    if (r.calendrier_auto && now.heure === 18 && now.minute < 5) {
      const demain = new Date(`${now.date}T00:00:00Z`);
      demain.setUTCDate(demain.getUTCDate() + 1);
      const { data: items } = await supabase
        .from("editorial_items")
        .select("id, gabarit, accroche, texte, hashtags")
        .eq("brand_id", brandId)
        .eq("jour", iso(demain))
        .in("statut", ["prevu", "garde"]);

      for (const it of items ?? []) {
        const gabarit = String(it.gabarit ?? "");
        if (!GABARITS_AUTO.has(gabarit)) continue; // le rebours a sa propre règle
        const cle = `cal:${it.id}`;
        if (await dejaFait(supabase, brandId, cle)) continue;
        await marquer(supabase, brandId, cle);
        try {
          const texte = String(it.texte ?? "");
          const champs: ChampsGabarit =
            gabarit === "avis"
              ? { texte: texte.slice(0, 300) }
              : {
                  titre: String(it.accroche ?? "").slice(0, 60),
                  sous: texte.slice(0, 140),
                  photoUrl: urlPublique(supabase, await dernierePhoto(supabase, brandId)),
                };
          const jobId = await programmer(supabase, {
            brandId,
            gabarit: gabarit as Gabarit,
            themeCle: theme,
            champs,
            legende: `${it.accroche ?? ""}\n\n${texte}${it.hashtags ? `\n\n${it.hashtags}` : ""}`.trim(),
            quand: instantParis(iso(demain), 11, 30),
            cibles,
            origine: "auto-calendrier",
          });
          await supabase
            .from("editorial_items")
            .update({ statut: "programme", job_id: jobId || null })
            .eq("id", it.id);
          journal.push(`contenu du calendrier programmé pour demain (${gabarit})`);
        } catch (e) {
          journal.push(`contenu du calendrier en échec : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }
  }

  return journal;
}
