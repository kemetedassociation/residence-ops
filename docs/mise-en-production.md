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
