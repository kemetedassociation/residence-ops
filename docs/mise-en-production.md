# Passer de la démo à un usage réel

Le site en ligne est initialisé avec des **comptes de démonstration aux identifiants publics**
(`manager@residence-ops.fr` / `manager123`, etc.). Pour accueillir de vrais résidents :

1. Dans le dépôt privé de sauvegardes (`residence-ops-backups`), supprimer le fichier
   `latest.sqlite.enc` (sinon la base de démo serait restaurée au prochain démarrage).
2. Sur Render → Environment, ajouter :
   - `SEED_MODE` = `production`
   - `INITIAL_RESIDENCE_NAME` = nom de la résidence
   - `INITIAL_MANAGER_EMAIL` = email du gestionnaire
   - `INITIAL_MANAGER_PASSWORD` = mot de passe (12 caractères minimum)
   - `ALLOWED_ORIGIN` = URL publique du site
   - SMTP (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) pour les emails
3. Redéployer : le serveur démarre avec une base vide, crée la résidence et le gestionnaire.
4. Se connecter, puis créer les bâtiments depuis Paramètres.

Limites connues du plan gratuit : les photos jointes (dossier uploads) ne sont pas sauvegardées et
sont perdues à chaque redéploiement ; le service se met en veille après inactivité (premier chargement
lent) ; jusqu'à 15 minutes de données peuvent être perdues en cas d'arrêt brutal.

## Documents PDF

Les PDF et justificatifs (module Administration) sont stockés dans un dossier **privé** (jamais servi
publiquement) et ne sont lisibles que par leur propriétaire et le gestionnaire de la résidence. Comme les
photos, ces fichiers vivent sur le disque du serveur : **ils sont perdus à chaque redéploiement sur le plan
gratuit Render** (l'app l'indique au lieu de planter). Pour les conserver, il faut un disque persistant
(plan payant) : définir alors `UPLOADS_DIR=/data/uploads` — les fichiers privés suivent automatiquement dans
`/data/private-files`.

## Paiement en ligne (Stripe, Mollie, PayPal, HelloAsso)

Les résidents rechargent leur porte-monnaie depuis « Ma carte ». Le gestionnaire choisit les moyens proposés dans
**Paiements** (menu de gauche) : activer un ou plusieurs prestataires, saisir ses clés (enregistrées chiffrées, jamais
réaffichées), tester la connexion. Le paiement se fait toujours sur la page du prestataire : aucune donnée bancaire ne
passe par Résidence Ops. L'argent va directement sur le compte que le gestionnaire configure.

Sécurité : le solde n'est crédité qu'après **vérification auprès du prestataire** (webhook signé pour Stripe ; relecture du
paiement par l'API pour Mollie, PayPal et HelloAsso), une seule fois, et seulement si le montant encaissé correspond.
La configuration est **bloquée tant que l'application est en mode démonstration** (compte gestionnaire aux identifiants
publics) : passez d'abord en mode production (section précédente).

| Prestataire | À prévoir | Notes |
|---|---|---|
| Stripe | Clé secrète + secret de webhook | Créer le webhook (adresse et événements affichés dans la page Paiements). Apple Pay / Google Pay inclus. |
| Mollie | Clé API | Aucune configuration de webhook : l'adresse est fournie à chaque paiement. |
| PayPal | Client ID + Secret, environnement | Le débit n'a lieu qu'à la capture côté serveur, au retour. |
| HelloAsso | Client ID + Secret + identifiant (slug) de l'association | Réservé aux associations ; HelloAsso ajoute une contribution volontaire ; vérifier la compatibilité avec un rechargement de crédit. Adresse de notification facultative : le retour et le bouton « Vérifier les paiements en attente » suffisent. |

Chaque prestataire a un mode test (sandbox) : commencer par là. Un bouton « Vérifier les paiements en attente » rattrape un
paiement encaissé dont la notification a été manquée.

**Non testé avec de vrais comptes** : Mollie, PayPal et HelloAsso ont été écrits d'après leur documentation officielle et
testés avec de faux serveurs. Faire un paiement de test en sandbox pour chacun avant de l'activer.

À savoir avant d'encaisser : frais du prestataire (environ 1,5 % + 0,25 € par carte européenne chez Stripe/Mollie) ; les
remboursements se font à la main chez le prestataire (et le solde du résident doit être ajusté) ; les conditions de vente et
de remboursement du crédit doivent être validées par un juriste (statut du crédit prépayé).

## Pièces jointes des signalements (photos et PDF)

Au signalement, le résident joint des photos ou des PDF et choisit qui peut les voir : **réservé à la gestion** (par
défaut, avec le technicien et lui-même) ou **visible par les résidents** de la résidence. Ces fichiers passent par le
stockage sécurisé (mêmes règles que les documents administratifs) : ils ne sont jamais servis publiquement. Les
anciens signalements gardent leurs photos publiques d'origine. Comme les autres fichiers, ils sont perdus à chaque
redéploiement sur le plan gratuit Render.

## Accompagnement psychologique (bouton « Besoin d'aide »)

- **Numéros d'urgence** (3114, 15, 112, etc.) affichés dans `client/src/lib/care.js` : à **faire vérifier avant la mise en
  production** (ils peuvent changer). La page `/aide` est publique : elle reste accessible sans connexion.
- **Professionnels** : le gestionnaire les ajoute dans « Accompagnement » et transmet à chacun un lien d'invitation à usage
  unique (14 jours). Le professionnel choisit lui-même son mot de passe sur `/psy` : ensuite, **personne d'autre** ne peut lire
  son agenda, pas même la gestion. Si un professionnel perd son mot de passe, on ne peut pas le réinviter (protection contre la
  prise de contrôle) : supprimer sa fiche, puis la recréer (ses rendez-vous sont annulés et les résidents prévenus).
- **Confidentialité** : la gestion ne voit que des compteurs. Les rendez-vous sont des données de santé (RGPD, art. 9) : la
  politique de confidentialité en fait mention ; faire valider ce point par un juriste, et vérifier que chaque professionnel est
  bien autorisé à exercer et a donné son accord pour figurer dans l'annuaire.
- Les profils de la démo sont **fictifs** : ils n'existent pas en mode production (`SEED_MODE=production`).
- Ajout à l'agenda : fichier .ics, Google Agenda, Outlook ; le professionnel peut aussi s'abonner à un agenda partagé (adresse
  secrète, affichée une seule fois). Le titre des événements côté résident est neutre (« Rendez-vous — Nom »).

## Comptes administrateurs et permissions

Chaque membre de l'équipe a son propre compte, limité à son domaine : **Équipe et accès** (menu du gestionnaire).

- **Administrateur principal** (accès complet) : le compte gestionnaire créé au départ. Lui seul peut accorder un accès
  complet à un autre compte, ou modifier/suspendre/supprimer un autre administrateur à accès complet — pour qu'une
  personne non habilitée ne puisse jamais se neutraliser mutuellement ou s'auto-promouvoir.
- **Administrateur restreint** : limité aux modules cochés (Incidents, Actualités, Restaurant, Documents, Rendez-vous,
  Loisirs, Résidents et baux, Accompagnement, Paiements, Erreurs, Paramètres). Un administrateur restreint ne peut JAMAIS
  accorder à quelqu'un d'autre une fonctionnalité qu'il ne possède pas lui-même, ni créer un accès complet — même s'il a
  reçu la permission « Gestion des comptes administrateurs ».
- **Technicien** : même mécanisme, limité par défaut aux incidents. Se connecte sur le même écran que les gestionnaires
  (`/admin-login`) et n'y voit que les sections qui lui sont accordées.
- **Suspendre** un compte coupe l'accès immédiatement (connexion et session en cours), sans supprimer son historique.
  Impossible de suspendre/supprimer le dernier administrateur à accès complet de la résidence (cela bloquerait tout le
  monde), ni son propre compte.
- Les retraits de permission prennent effet immédiatement, sans attendre l'expiration du jeton de connexion (7 jours).

Comptes de démonstration : `manager@residence-ops.fr` (accès complet), `marc.lefevre@residence-ops.fr` / `technicien123`
(incidents uniquement), `loisirs.demo@residence-ops.fr` / `loisirs-demo-2026` (loisirs uniquement).

## Isis (chatbot) : reconnaissance des fautes de frappe et voix Azure

Le chatbot (bulle en bas à droite, visible uniquement connecté) s'appelle **Isis**. Deux évolutions, aucune ne nécessite
de configuration pour fonctionner de base :

- **Tolérance aux fautes d'orthographe** : la reconnaissance d'intention (`client/src/lib/chatbotKnowledge.js`) compare
  chaque mot tapé par distance de Levenshtein (nombre de lettres à changer) plutôt que par correspondance exacte, avec
  une tolérance proportionnelle à la longueur du mot. Un résident qui écrit « rezervé un rendez vous » ou « je veux
  signalé une fuite » est compris malgré la faute. Les mots de 1-2 lettres (« a », « ce », « du »...) sont exclus de
  cette tolérance pour éviter les faux positifs (un mot aussi court ressemble, par hasard, à des dizaines de mots).
  Fonctionne sans aucune clé ni service externe.
- **Répertoire élargi** : Isis couvre désormais toutes les sections ajoutées au fil du projet — suivi d'incident, page
  « Besoin d'aide », installation de l'app, et côté gestionnaire : Accompagnement, Paiements, Équipe et accès, Erreurs,
  notifications. Chaque intention côté gestionnaire est associée à la permission requise (voir « Comptes administrateurs
  et permissions » ci-dessus) : Isis ne proposera jamais à un administrateur restreint une section qu'il ne peut pas
  utiliser.
- **Voix d'Isis (Azure AI Speech)** : par défaut, Isis parle avec la voix native (robotique) du navigateur. Pour lui
  donner une voix naturelle, créer une ressource **Azure AI services → Speech** (portail Azure, offre gratuite
  disponible) et renseigner sur Render :
  - `AZURE_SPEECH_KEY` : une des clés de la ressource Speech.
  - `AZURE_SPEECH_REGION` : la région de la ressource (ex. `francecentral`).
  - `AZURE_SPEECH_VOICE` (facultatif) : nom d'une voix neuronale française, par défaut `fr-FR-DeniseNeural` (liste des
    voix disponibles dans la documentation Azure AI Speech).

  La clé Azure ne quitte jamais le serveur : le navigateur appelle `/api/assistant/speech`, qui renvoie l'audio déjà
  généré. Sans ces variables, l'appel échoue silencieusement (503) et Isis bascule sur la voix du navigateur — aucune
  erreur visible, aucune action requise si vous ne voulez pas configurer Azure.
