/**
 * Droits par module, côté application.
 *
 * Rappel de ce qui compte : cette couche sert à ne pas afficher ce qui n'est
 * pas accessible. Elle n'est PAS la barrière de sécurité. La barrière est en
 * base — les policies de la greffe vérifient can_use_module_brand sur chaque
 * table de prospection. Masquer un lien sans policy laisserait la donnée
 * lisible par l'API REST de Supabase.
 *
 * Deux questions distinctes, à ne jamais confondre :
 *   - l'organisation a-t-elle le module (abonnement, et pour la prospection un
 *     avenant qui engage juridiquement) ;
 *   - ce membre-là y a-t-il accès (rôle).
 */

export const MODULES = ["communication", "prospection"] as const;
export type AppModule = (typeof MODULES)[number];

export const MODULE_LABELS: Record<AppModule, string> = {
  communication: "Communication",
  prospection: "Prospection",
};

export const MODULE_DESCRIPTIONS: Record<AppModule, string> = {
  communication:
    "Stratégie, plannings, contenus, publication, boîte de réception, rapport mensuel.",
  prospection:
    "Emplacements, scoring, séquences de contact, autorisations, devis sortants.",
};

export interface ModuleAccess {
  module: AppModule;
  canWrite: boolean;
}

export function hasModule(modules: ModuleAccess[], m: AppModule): boolean {
  return modules.some((x) => x.module === m);
}
