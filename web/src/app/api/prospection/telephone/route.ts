import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Numéro d'une entreprise, à l'affichage seulement — jamais stocké.
 *
 * L'API Recherche d'entreprises ne donne pas de téléphone ; Google Places
 * Details, si. Mais la licence Google interdit de stocker les données Places
 * au-delà d'un cache temporaire, de les afficher hors carte Google, ou de les
 * revendre. Un champ contact_phone écrit en base et exporté en CSV sortirait de
 * ce cadre. Donc : récupération à la volée sur clic humain, cache mémoire court,
 * aucune écriture en base, absent de l'export.
 *
 * Déclencheur : toujours un clic sur une fiche précise. Jamais le cron.
 */

/** Cache mémoire court : ne pas payer deux fois le même appel dans la session. */
const cache = new Map<string, { phone: string | null; website: string | null; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Plafond quotidien par organisation, en dur, non contournable depuis
 * l'interface. On cherche quelques numéros par jour, pas des centaines. En
 * mémoire (pas de stockage) : sur serverless, la borne est par instance — c'est
 * un plafond de sécurité contre l'emballement, pas un compteur comptable.
 */
const MAX_PER_ORG_PER_DAY = 25;
const dailyCount = new Map<string, { day: string; n: number }>();

function todayParis(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erreur: "non autorisé" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = body.id;
  if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });

  // RLS : ne renvoie l'opportunité que si l'utilisateur a la marque et le module.
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, name, address, city, postal_code, family")
    .eq("id", id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  if (opp.family !== "daily_flow") {
    return NextResponse.json(
      { erreur: "réservé aux opportunités de type entreprise" },
      { status: 400 },
    );
  }

  // Cache mémoire : renvoie sans repayer.
  const cached = cache.get(id);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ phone: cached.phone, website: cached.website, cached: true });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      { erreur: "recherche de numéro indisponible (clé absente)" },
      { status: 503 },
    );
  }

  // Plafond quotidien par organisation.
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const orgId = (membership?.organization_id as string | undefined) ?? "sans-org";
  const day = todayParis();
  const cur = dailyCount.get(orgId);
  const used = cur && cur.day === day ? cur.n : 0;
  if (used >= MAX_PER_ORG_PER_DAY) {
    return NextResponse.json(
      { erreur: "plafond quotidien de recherche de numéros atteint" },
      { status: 429 },
    );
  }

  const query = [opp.name, opp.address, opp.postal_code, opp.city]
    .filter(Boolean)
    .join(", ");

  let phone: string | null = null;
  let website: string | null = null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.displayName",
      },
      body: JSON.stringify({
        textQuery: query,
        regionCode: "FR",
        languageCode: "fr",
        maxResultCount: 1,
      }),
      cache: "no-store",
    });
    // On compte l'appel dès qu'il est parti : c'est lui qui coûte.
    dailyCount.set(orgId, { day, n: used + 1 });
    if (!res.ok) {
      return NextResponse.json({ erreur: `google ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as {
      places?: Array<{
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
      }>;
    };
    const place = data.places?.[0];
    phone = place?.nationalPhoneNumber ?? place?.internationalPhoneNumber ?? null;
    website = place?.websiteUri ?? null;
  } catch {
    return NextResponse.json({ erreur: "recherche impossible" }, { status: 502 });
  }

  // Cache mémoire court, aucune écriture en base (contrainte de licence Google).
  cache.set(id, { phone, website, at: Date.now() });

  return NextResponse.json({ phone, website });
}
