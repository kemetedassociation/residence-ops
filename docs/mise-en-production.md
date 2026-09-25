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
