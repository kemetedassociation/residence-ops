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

## Paiement en ligne (Stripe)

Les résidents peuvent recharger leur porte-monnaie par carte bancaire (page « Ma carte »). Le paiement se fait sur
la page hébergée par Stripe : aucune donnée bancaire ne passe par Résidence Ops. Le solde n'est crédité que par le
**webhook signé** de Stripe, jamais sur simple retour du navigateur, et une seule fois même si Stripe renvoie l'événement.
Sans configuration, le bouton est masqué et la recharge se fait à l'accueil (TPE de la résidence, puis le gestionnaire
ajoute le montant depuis la fiche du résident, en indiquant TPE / espèces / chèque).

Mise en place (commencer en **mode test**) :
1. Créer un compte sur stripe.com, récupérer la clé secrète de test (`sk_test_...`).
2. Développeurs → Webhooks → Ajouter un point de terminaison : `https://VOTRE-SITE/api/payments/webhook`, événements
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`. Copier le secret de signature (`whsec_...`).
3. Dans Render → Environment : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` (adresse publique du site).
4. Tester avec la carte 4242 4242 4242 4242 (date future, CVC quelconque) : le solde doit augmenter.
5. Pour encaisser pour de vrai : activer le compte Stripe (informations légales de la structure), remplacer par les clés
   `sk_live_...` et créer le webhook en mode live.

À savoir avant d'encaisser : Stripe prélève des frais (environ 1,5 % + 0,25 € par carte européenne) ; les remboursements se
font à la main depuis Stripe (et le solde du résident doit être ajusté en conséquence) ; les conditions de vente et de
remboursement du crédit doivent être affichées et validées par un juriste (statut du crédit prépayé).
