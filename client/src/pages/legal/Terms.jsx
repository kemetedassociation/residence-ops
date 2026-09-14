import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useBranding } from "../../context/BrandingContext";

export function Terms() {
  const { displayName } = useBranding();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link to="/select" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Conditions générales d'utilisation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Version 2026-09-v1</p>
      </div>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Objet</h2>
        <p>
          « {displayName} » est un outil de gestion de la vie en résidence : signalement d'incidents, actualités,
          suggestions, et selon les modules activés par votre résidence, porte-monnaie interne, restauration,
          démarches administratives et activités.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">2. Compte utilisateur</h2>
        <p>
          Vous êtes responsable de la confidentialité de votre mot de passe. Les informations fournies (identité,
          numéro de bail) doivent être exactes ; la gestion de la résidence peut vérifier votre numéro de bail avant
          de débloquer certaines fonctionnalités.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">3. Signalements et bonne foi</h2>
        <p>
          Les incidents signalés doivent correspondre à des faits réels. Tout contenu injurieux, diffamatoire ou
          manifestement abusif peut être modéré ou entraîner une restriction d'accès à votre compte par la gestion.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">4. Porte-monnaie interne (si activé)</h2>
        <p>
          Le solde affiché dans l'application n'est pas un moyen de paiement bancaire : il représente un crédit
          interne à la résidence, alimenté par le personnel d'accueil. Il n'est ni transférable ni remboursable en
          numéraire, sauf disposition contraire de la résidence.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">5. Responsabilité</h2>
        <p>
          L'application est un outil de mise en relation et de suivi ; elle ne remplace pas les procédures d'urgence
          (sécurité, incendie) de votre résidence. En cas d'urgence, contactez directement le personnel ou les
          services d'urgence.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">6. Données personnelles</h2>
        <p>
          Le traitement de vos données personnelles est décrit dans notre{" "}
          <Link to="/confidentialite" className="text-primary underline-offset-4 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
