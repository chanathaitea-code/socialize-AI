import Link from "next/link";

export const metadata = { title: "Suppression de vos données — SocialFlow AI" };

/**
 * Adresse exigée par Meta au titre des « instructions de suppression des
 * données ». Elle doit être publique et décrire une marche à suivre claire.
 */
export default function SuppressionPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b1512] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto font-extrabold">
          Social<span className="text-[#3ecf9a]">Flow</span> AI
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10 text-[#12211c] leading-relaxed">
        <h1 className="text-2xl font-bold">Supprimer vos données</h1>
        <p className="text-sm text-gray-500 mt-1">Dernière mise à jour : 3 août 2026</p>

        <h2 className="text-lg font-bold mt-8">Retirer l&apos;accès à un réseau</h2>
        <p className="mt-2">
          Connectez-vous, ouvrez l&apos;écran <b>Mes réseaux</b> et cliquez sur <b>Déconnecter</b> en face du compte
          concerné. Le jeton d&apos;accès est immédiatement effacé de nos serveurs et l&apos;application ne peut plus
          rien publier ni lire sur ce compte.
        </p>
        <p className="mt-3">
          Vous pouvez faire la même chose sans passer par nous : dans Facebook, depuis <i>Paramètres et
          confidentialité → Paramètres → Applications et sites web</i> ; dans votre compte Google, depuis <i>Sécurité →
          Applications tierces ayant accès à votre compte</i>.
        </p>

        <h2 className="text-lg font-bold mt-8">Supprimer entièrement votre compte</h2>
        <p className="mt-2">
          Écrivez à{" "}
          <a href="mailto:chanathaitea@gmail.com" className="text-[#0f6b53] underline">
            chanathaitea@gmail.com
          </a>{" "}
          depuis l&apos;adresse électronique de votre compte, avec pour objet <b>Suppression de compte</b>. Nous
          effaçons alors, sous trente jours au plus :
        </p>
        <ul className="mt-3 space-y-1.5 list-disc pl-5">
          <li>votre compte d&apos;accès et votre adresse électronique ;</li>
          <li>le profil de votre entreprise, votre carte, vos emplacements et vos réglages ;</li>
          <li>les jetons d&apos;accès à vos réseaux sociaux, effacés dès réception de la demande ;</li>
          <li>les photos et visuels que vous avez importés ou fabriqués ;</li>
          <li>l&apos;historique de vos publications et les statistiques conservées.</li>
        </ul>
        <p className="mt-3">
          Nous vous confirmons la suppression par retour de courrier électronique. Les publications déjà parues sur vos
          propres comptes appartiennent à ces comptes : elles ne sont pas supprimées par cette démarche, et restent
          sous votre contrôle depuis Instagram, Facebook ou Google.
        </p>

        <h2 className="text-lg font-bold mt-8">Ce que nous conservons malgré tout</h2>
        <p className="mt-2">
          Aucune donnée personnelle. Seules subsistent, le cas échéant, les pièces comptables que la loi nous impose de
          conserver, et des relevés techniques anonymes sans lien avec votre identité.
        </p>

        <p className="mt-10 text-sm text-gray-500">
          <Link href="/confidentialite" className="text-[#0f6b53] underline">
            Politique de confidentialité
          </Link>{" "}
          ·{" "}
          <Link href="/conditions" className="text-[#0f6b53] underline">
            Conditions d&apos;utilisation
          </Link>
        </p>
      </article>
    </main>
  );
}
