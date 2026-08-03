import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  MODULES,
  MODULE_DESCRIPTIONS,
  MODULE_LABELS,
  type AppModule,
} from "@/lib/modules";
import Nav from "../nav";
import { toggleMemberModule, toggleOrgModule } from "./actions";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["owner", "agency_admin"]);

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  agency_admin: "Administrateur agence",
  brand_manager: "Gestionnaire de marque",
  client_validator: "Validateur",
  staff: "Équipier",
  member: "Membre",
};

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { ok, err } = await searchParams;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("memberships")
    .select("id, organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const orgId = me?.organization_id;
  const isAdmin = me ? ADMIN_ROLES.has(me.role) : false;

  const [{ data: orgModulesRows }, { data: members }, { data: memberModules }] =
    await Promise.all([
      supabase.from("organization_modules").select("module, enabled"),
      supabase.from("memberships").select("id, user_id, role").order("created_at"),
      supabase.from("membership_modules").select("membership_id, module"),
    ]);

  const orgActive: Record<AppModule, boolean> = {
    communication: false,
    prospection: false,
  };
  for (const r of orgModulesRows ?? []) {
    if ((MODULES as readonly string[]).includes(r.module)) {
      orgActive[r.module as AppModule] = Boolean(r.enabled);
    }
  }

  const access = new Set(
    (memberModules ?? []).map((r) => `${r.membership_id}:${r.module}`),
  );

  return (
    <main className="min-h-screen bg-[#f4f4f1]">
      <Nav actif="/modules" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <h2 className="text-xl font-bold text-[#12211c]">Modules et droits</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          Deux niveaux distincts. L&apos;organisation dispose d&apos;un module —
          c&apos;est l&apos;abonnement. Chaque membre y a accès ou non — c&apos;est
          le rôle. Un membre ne peut jamais recevoir un module que
          l&apos;organisation n&apos;a pas.
        </p>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Problème : {err}
          </div>
        )}
        {ok && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ {ok}
          </div>
        )}

        {!isAdmin && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Vous consultez les droits sans pouvoir les modifier : seuls le
            propriétaire et l&apos;administrateur agence peuvent activer un module
            ou accorder un accès.
          </div>
        )}

        <h3 className="mt-8 text-base font-bold text-[#12211c]">
          Modules de l&apos;organisation
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {MODULES.map((m) => (
            <div
              key={m}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#12211c]">
                    {MODULE_LABELS[m]}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {MODULE_DESCRIPTIONS[m]}
                  </p>
                </div>
                <form action={toggleOrgModule}>
                  <input type="hidden" name="module" value={m} />
                  <input type="hidden" name="enable" value={String(!orgActive[m])} />
                  <button
                    type="submit"
                    disabled={!isAdmin}
                    aria-pressed={orgActive[m]}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      orgActive[m]
                        ? "bg-[#0f6b53] text-white hover:opacity-90"
                        : "border border-gray-300 text-gray-600 hover:border-[#0f6b53]"
                    }`}
                  >
                    {orgActive[m] ? "Actif" : "Inactif"}
                  </button>
                </form>
              </div>
              {m === "prospection" && orgActive[m] && (
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-[#0f6b53]">
                  Avenant accepté · registre des traitements étendu
                </p>
              )}
            </div>
          ))}
        </div>

        <h3 className="mt-8 text-base font-bold text-[#12211c]">
          Accès des membres
        </h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {(members ?? []).map((mb) => (
            <div
              key={mb.id}
              className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#12211c]">
                  {ROLE_LABELS[mb.role] ?? mb.role}
                  {mb.user_id === user.id && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      (vous)
                    </span>
                  )}
                </span>
                <span className="block font-mono text-xs text-gray-400">
                  {mb.user_id.slice(0, 8)}…
                </span>
              </span>
              {MODULES.map((m) => {
                const on = access.has(`${mb.id}:${m}`);
                const locked = !orgActive[m];
                return (
                  <form action={toggleMemberModule} key={m}>
                    <input type="hidden" name="membership_id" value={mb.id} />
                    <input type="hidden" name="module" value={m} />
                    <input type="hidden" name="grant" value={String(!on)} />
                    <button
                      type="submit"
                      disabled={!isAdmin || locked}
                      aria-pressed={on}
                      title={
                        locked
                          ? `Activez d'abord le module ${MODULE_LABELS[m]} sur l'organisation`
                          : undefined
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                        locked
                          ? "border border-gray-200 text-gray-300"
                          : on
                            ? "bg-[#0f6b53] text-white hover:opacity-90"
                            : "border border-gray-300 text-gray-500 hover:border-[#0f6b53]"
                      }`}
                    >
                      {MODULE_LABELS[m]}
                    </button>
                  </form>
                );
              })}
            </div>
          ))}
          {(members ?? []).length === 0 && (
            <p className="px-5 py-4 text-sm text-gray-500">
              Aucun membre visible. {orgId ? "" : "Organisation introuvable."}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-xl border-l-4 border-[#12211c] bg-white p-5">
          <p className="text-sm font-semibold text-[#12211c]">
            Où la règle est réellement tenue
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Cet écran masque et affiche. La barrière est en base : les policies
            vérifient le module sur chaque table de prospection. Sans elles, un
            membre sans le module lirait quand même les données par l&apos;API
            REST — l&apos;interface ne protège rien.
          </p>
        </div>
      </div>
    </main>
  );
}
