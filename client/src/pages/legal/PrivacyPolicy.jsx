import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useBranding } from "../../context/BrandingContext";

export function PrivacyPolicy() {
  const { displayName } = useBranding();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link to="/select" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Politique de confidentialité</h1>
        <p className="mt-1 text-sm text-muted-foreground">Version 2026-09-v1 — dernière mise à jour : septembre 2026.</p>
      </div>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Responsable du traitement</h2>
        <p>
          Les données sont traitées par le gestionnaire de votre résidence, via l'application « {displayName} ».
          Pour toute question relative à vos données, contactez la gestion de votre résidence depuis l'onglet Profil,
          ou l'éditeur de l'application à l'adresse indiquée dans vos conditions générales.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">2. Données collectées</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Identité :</strong> nom, email, téléphone, bâtiment et numéro de chambre, numéro de bail.</li>
          <li><strong>Signalements :</strong> incidents que vous rapportez (catégorie, description, photos, localisation).</li>
          <li><strong>Interactions :</strong> confirmations d'incidents, suggestions, avis de satisfaction.</li>
          <li><strong>Notifications :</strong> historique des notifications reçues et abonnement aux notifications push (identifiant technique de votre appareil, jamais son contenu).</li>
          <li><strong>Vie de résidence :</strong> selon les modules activés par votre résidence — solde et historique d'un porte-monnaie interne, réservations de repas, demandes de documents administratifs, rendez-vous avec le personnel, inscriptions à des activités.</li>
          <li><strong>Technique :</strong> jeton de connexion (stocké sur votre appareil), préférences d'affichage.</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">3. Finalités et base légale</h2>
        <p>
          Ces données sont traitées pour l'exécution du service que vous avez demandé en créant un compte (gestion des
          incidents, vie de résidence) — base légale : exécution du contrat / intérêt légitime de bon fonctionnement
          de la résidence. Aucune donnée n'est utilisée à des fins publicitaires ni cédée à des tiers commerciaux.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">4. Conservation</h2>
        <p>
          Les données de compte sont conservées pendant la durée de votre présence dans la résidence, puis 3 ans à
          compter de votre départ à des fins de preuve en cas de litige, sauf demande d'effacement anticipée. Les
          incidents signalés peuvent être conservés au-delà, de façon anonymisée, pour l'historique de maintenance du
          bâtiment.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">5. Vos droits</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de
          rectification, d'effacement et de portabilité de vos données. Depuis votre <strong>Profil</strong>, vous
          pouvez :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Télécharger l'intégralité de vos données dans un fichier structuré (droit à la portabilité) ;</li>
          <li>Demander l'anonymisation de votre compte (droit à l'effacement) — vos données d'identification sont
            alors définitivement remplacées, à l'exception des données que la résidence doit conserver pour son
            intérêt légitime de gestion (voir section 4).</li>
        </ul>
        <p>
          Vous disposez également d'un droit de réclamation auprès de la CNIL (
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            www.cnil.fr
          </a>
          ).
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">5 bis. Accompagnement psychologique (données de santé)</h2>
        <p>
          Si vous prenez rendez-vous avec un psychologue ou un professionnel de santé via « Besoin d'aide », votre nom, votre chambre, le créneau choisi et le
          message facultatif que vous rédigez sont des <b>données de santé</b>, traitées uniquement avec votre consentement. Elles ne sont accessibles qu'à vous et au
          professionnel concerné ; <b>la gestion de la résidence n'y a pas accès</b> et ne voit que des statistiques anonymes. Votre e-mail et votre téléphone ne lui sont
          transmis que si vous cochez la case prévue. Vous pouvez annuler un rendez-vous à tout moment ; la suppression de votre compte efface vos rendez-vous.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">6. Cookies et stockage local</h2>
        <p>
          L'application n'utilise aucun cookie de mesure d'audience ni publicitaire. Un jeton de connexion et vos
          préférences d'affichage sont stockés localement sur votre appareil (« local storage »), uniquement pour
          assurer votre session et votre confort d'utilisation.
        </p>
      </section>

      <section className="space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">7. Sécurité</h2>
        <p>
          Les mots de passe sont chiffrés (hachage). Les échanges avec le serveur sont protégés, l'accès aux données
          est restreint par rôle (résident / personnel / gestion), et les tentatives de connexion sont limitées pour
          prévenir les abus.
        </p>
      </section>
    </div>
  );
}
