import Link from "next/link";

export const metadata = { title: "Conditions d'utilisation — SocialFlow AI" };

export default function ConditionsPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="bg-[#0b1512] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto font-extrabold">
          Social<span className="text-[#3ecf9a]">Flow</span> AI
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10 text-[#12211c] leading-relaxed">
        <h1 className="text-2xl font-bold">Conditions d&apos;utilisation</h1>
        <p className="text-sm text-gray-500 mt-1">Dernière mise à jour : 3 août 2026</p>

        <h2 className="text-lg font-bold mt-8">Objet du service</h2>
        <p className="mt-2">
          SocialFlow AI aide une entreprise à préparer, programmer et publier ses contenus sur ses propres comptes de
          réseaux sociaux, et à en mesurer les résultats. Le service est édité par Chana Thaï, établi en Île-de-France.
        </p>

        <h2 className="text-lg font-bold mt-8">Votre compte</h2>
        <p className="mt-2">
          Vous êtes responsable de la confidentialité de vos identifiants et de l&apos;usage qui est fait de votre
          compte. Vous vous engagez à ne connecter que des comptes de réseaux sociaux dont vous êtes titulaire ou dont
          vous avez reçu l&apos;autorisation expresse du titulaire.
        </p>

        <h2 className="text-lg font-bold mt-8">Vos contenus</h2>
        <p className="mt-2">
          Les textes, photos et visuels que vous importez ou faites produire restent votre propriété. Vous nous
          accordez le seul droit de les traiter et de les publier sur les comptes que vous avez connectés, pour votre
          compte et sur votre instruction. Vous garantissez détenir les droits nécessaires sur ce que vous publiez.
        </p>

        <h2 className="text-lg font-bold mt-8">Contenus proposés par l&apos;intelligence artificielle</h2>
        <p className="mt-2">
          Le service propose des textes et des visuels produits automatiquement. Ils sont des propositions : leur
          exactitude n&apos;est pas garantie, et il vous appartient de les relire avant publication. Lorsque vous
          activez la publication automatique, vous acceptez que des contenus partent sans relecture, après le délai
          d&apos;annulation que vous avez vous-même réglé. Vous restez seul responsable de ce qui est publié sous votre
          nom, notamment des prix affichés, des allégations et des mentions réglementaires propres à votre activité.
        </p>

        <h2 className="text-lg font-bold mt-8">Disponibilité</h2>
        <p className="mt-2">
          Le service dépend d&apos;interfaces fournies par des tiers — Meta, Google, TikTok — qui peuvent en modifier
          ou en interrompre l&apos;accès sans préavis. Nous ne pouvons garantir ni la continuité de ces interfaces, ni
          les résultats obtenus sur vos réseaux.
        </p>

        <h2 className="text-lg font-bold mt-8">Résiliation</h2>
        <p className="mt-2">
          Vous pouvez cesser d&apos;utiliser le service à tout moment et demander la suppression de vos données. Nous
          pouvons suspendre un compte qui contreviendrait aux présentes conditions ou aux règles des plateformes
          connectées.
        </p>

        <h2 className="text-lg font-bold mt-8">Droit applicable</h2>
        <p className="mt-2">Les présentes conditions sont soumises au droit français.</p>

        <p className="mt-10 text-sm text-gray-500">
          <Link href="/confidentialite" className="text-[#0f6b53] underline">
            Politique de confidentialité
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
