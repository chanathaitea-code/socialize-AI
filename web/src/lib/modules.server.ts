import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { MODULES, type ModuleAccess } from "@/lib/modules";

/**
 * Résolution des modules côté serveur.
 *
 * Séparé de lib/modules.ts parce qu'un composant client qui importe les
 * libellés ne doit pas embarquer le client Supabase serveur. La marque
 * "server-only" fait échouer la compilation si l'import fuit vers le
 * navigateur — mieux vaut un build cassé qu'une clé qui traverse.
 *
 * Rappel : cette couche sert à ne pas afficher ce qui n'est pas accessible.
 * Elle n'est PAS la barrière de sécurité. La barrière est en base, dans les
 * policies de la greffe (can_use_module_brand sur chaque table).
 *
 * On lit les modules du membre courant, pas de l'organisation entière : deux
 * membres de la même marque peuvent avoir des accès différents.
 */
export async function getActiveModules(): Promise<{
  modules: ModuleAccess[];
  connected: boolean;
}> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      modules: MODULES.map((m) => ({ module: m, canWrite: true })),
      connected: false,
    };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { modules: [], connected: true };

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { modules: [], connected: true };

  const { data } = await supabase
    .from("membership_modules")
    .select("module, can_write")
    .eq("membership_id", membership.id);

  return {
    modules: (data ?? []).map((r) => ({
      module: r.module as ModuleAccess["module"],
      canWrite: Boolean(r.can_write),
    })),
    connected: true,
  };
}
