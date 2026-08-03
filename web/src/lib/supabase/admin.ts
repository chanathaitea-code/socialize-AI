import { createClient } from "@supabase/supabase-js";

/**
 * Client de service, réservé aux traitements automatiques (tâche planifiée).
 * Il contourne les règles d'accès par utilisateur : ne jamais l'utiliser dans
 * du code déclenché par un visiteur.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
  return createClient(url, key, { auth: { persistSession: false } });
}
