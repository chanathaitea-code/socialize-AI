import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — SocialFlow AI" };

/**
 * Page publique exigée par Meta, Google et TikTok pour toute demande de
 * validation. Elle doit rester accessible sans connexion.
 */
export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b1512] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto font-extrabold">
          Social<span className="text-[#3ecf9a]">Flow</span> AI
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10 text-[#12211c] leading-relaxed">
        <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mt-1">Dernière mise à jour : 3 août 2026</p>

        <h2 className="text-lg font-bold mt-8">Qui est responsable de vos données</h2>
        <p className="mt-2">
          SocialFlow AI est un service de gestion de la communication sur les réseaux sociaux, édité par Chana Thaï,
          établi en Île-de-France, France. Pour toute question relative à vos données, écrivez à{" "}
          <a href="mailto:chanathaitea@gmail.com" className="text-[#0f6b53] underline">
            chanathaitea@gmail.com
          </a>
          .
        </p>

        <h2 className="text-lg font-bold mt-8">Ce que nous collectons</h2>
        <p className="mt-2">
          Nous collectons votre adresse électronique et votre mot de passe chiffré pour vous permettre de vous
          connecter. Nous conservons ensuite les informations que vous saisissez sur votre entreprise : son nom, son
          activité, son positionnement, sa clientèle, sa zone d&apos;intervention, son ton, ses objectifs, sa carte et
          ses prix, ses emplacements et ses horaires, ainsi que les photos que vous importez.
        </p>
        <p className="mt-3">
          Lorsque vous connectez un compte Instagram, une Page Facebook ou une fiche Google Business, nous recevons et
          conservons un jeton d&apos;accès délivré par la plateforme concernée, l&apos;identifiant et le nom du compte
          connecté. <b>Nous ne recevons jamais votre mot de passe</b> : vous vous authentifiez directement auprès de
          Meta ou de Google, qui nous délivrent une autorisation révocable.
        </p>
        <p className="mt-3">
          Nous conservons enfin l&apos;historique de vos publications et les statistiques associées — vues, portée,
          réactions, clics, abonnés — telles que les plateformes nous les communiquent.
        </p>

        <h2 className="text-lg font-bold mt-8">À quoi servent ces données</h2>
        <p className="mt-2">
          Elles servent exclusivement à fournir le service : préparer et publier vos contenus sur les comptes que vous
          avez connectés, vous montrer leurs résultats, et vous proposer des textes et des visuels adaptés à votre
          entreprise. Nous ne vendons aucune donnée, nous n&apos;en louons aucune, et nous n&apos;utilisons pas vos
          données pour de la publicité.
        </p>

        <h2 className="text-lg font-bold mt-8">Les autorisations que nous demandons</h2>
        <p className="mt-2">
          Sur Meta, nous demandons l&apos;accès à la liste de vos Pages et comptes Instagram professionnels afin que
          vous puissiez choisir lesquels rattacher, la permission de publier en votre nom sur ces comptes, et la
          lecture des statistiques de vos publications. Sur Google, nous demandons la gestion de votre fiche
          d&apos;établissement afin de publier vos emplacements, lire vos avis et y répondre à votre demande.
        </p>
        <p className="mt-3">
          Chaque autorisation ne s&apos;applique qu&apos;aux comptes que vous avez explicitement connectés, et vous
          pouvez la retirer à tout moment, depuis notre application comme depuis les réglages de Meta ou de Google.
        </p>

        <h2 className="text-lg font-bold mt-8">Sous-traitants</h2>
        <p className="mt-2">
          Vos données sont hébergées par Supabase, dans un centre de données situé à Paris, et l&apos;application est
          servie par Vercel. La rédaction de textes fait appel au modèle Gemini de Google : les éléments transmis se
          limitent au profil de votre entreprise, à votre carte et à vos emplacements, sans donnée personnelle de vos
          clients. Aucun de ces prestataires n&apos;est autorisé à utiliser vos données pour son propre compte.
        </p>

        <h2 className="text-lg font-bold mt-8">Combien de temps nous les gardons</h2>
        <p className="mt-2">
          Tant que votre compte existe. À sa suppression, l&apos;ensemble de vos données est effacé sous trente jours,
          y compris les jetons d&apos;accès, les photos importées et l&apos;historique des publications. Les
          publications déjà parues sur vos réseaux restent la propriété de vos comptes et ne sont pas affectées.
        </p>

        <h2 className="text-lg font-bold mt-8">Vos droits</h2>
        <p className="mt-2">
          Conformément au règlement général sur la protection des données, vous disposez d&apos;un droit d&apos;accès,
          de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Écrivez à{" "}
          <a href="mailto:chanathaitea@gmail.com" className="text-[#0f6b53] underline">
            chanathaitea@gmail.com
          </a>{" "}
          : nous répondons sous trente jours. Vous pouvez également introduire une réclamation auprès de la CNIL.
        </p>

        <h2 className="text-lg font-bold mt-8">Sécurité</h2>
        <p className="mt-2">
          Les jetons d&apos;accès à vos réseaux sont chiffrés avant enregistrement. L&apos;accès à la base est
          cloisonné par entreprise : les données d&apos;un client ne sont jamais lisibles par un autre. Les échanges
          entre votre navigateur et le service sont chiffrés.
        </p>

        <h2 className="text-lg font-bold mt-8">Modifications</h2>
        <p className="mt-2">
          Toute évolution de cette politique sera publiée sur cette page, avec sa date de mise à jour.
        </p>

        <p className="mt-10 text-sm text-gray-500">
          <Link href="/conditions" className="text-[#0f6b53] underline">
            Conditions d&apos;utilisation
          </Link>{" "}
          ·{" "}
          <Link href="/suppression-donnees" className="text-[#0f6b53] underline">
            Suppression de vos données
          </Link>
        </p>
      </article>
    </main>
  );
}
