# Résidence Ops

Application de gestion des incidents et de la vie de résidence étudiante : signalement d'incidents avec confirmation communautaire, planification d'interventions, actualités, suggestions, notifications temps réel et push, carte interactive, marque blanche par résidence, carte résident numérique avec porte-monnaie, restaurant (menus + réservations), espace administratif (documents + rendez-vous), planning des loisirs, conformité RGPD, et back-office gestionnaire complet.

Reconstruction indépendante inspirée de l'app Base44 "Résidence Ops" (`residenceinfo.base44.app`) — le code source original n'étant pas accessible sans abonnement Base44, ce projet a été reconstruit de zéro avec sa propre stack, en s'alignant sur le modèle de données et les parcours observés.

## Stack

- **Client** : React + Vite + Tailwind CSS + Radix UI, React Query, Framer Motion, Leaflet, Socket.IO client, PWA (manifest + service worker + Web Push)
- **Serveur** : Node + Express + SQLite (better-sqlite3) + JWT + Socket.IO + Zod (validation) + Web Push + Nodemailer
- **Tests** : Vitest + Supertest (serveur), Vitest + Testing Library (client)

## Prérequis

- Node.js **22.x** (LTS). ⚠️ Node 24.21 a un bug natif connu avec `better-sqlite3` (crash au démarrage) — utilisez Node 22.
- npm

Si vous utilisez `nvm` : `nvm use 22` (le fichier `.nvmrc` n'est pas fourni, pensez à l'installer avec `nvm install 22`).

## Installation

```bash
cd residence-ops
npm install
cp server/.env.example server/.env   # puis éditez server/.env si besoin (voir ci-dessous)
npm run seed      # crée la base de données SQLite avec des données de démo
npm run dev       # lance le serveur (http://localhost:3001) et le client (http://localhost:5173)
```

### Configuration (`server/.env`)

- `JWT_SECRET` : obligatoire, générez une valeur avec `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` : pour les notifications push, générez avec `npx web-push generate-vapid-keys`. Sans ces clés, les notifications in-app fonctionnent toujours, seul le push natif (app fermée) est désactivé.
- `SMTP_*` : laissez vide en développement — un compte de test [Ethereal](https://ethereal.email) est créé automatiquement et l'URL de prévisualisation de chaque email (mot de passe oublié) s'affiche dans les logs du serveur. En production, renseignez un vrai fournisseur SMTP.

Comptes de démo créés par le seed (voir `server/src/db/seed.js`) :

- Gestionnaire : `manager@residence-ops.fr` / `manager123`
- Résident (bail vérifié) : `etudiant@residence-ops.fr` / `resident123`
- Résident (bail en attente) : `sofia.rossi@residence-ops.fr` / `resident123`

## Tests

```bash
npm run test --workspace=server   # 46 tests d'intégration API
npm run test --workspace=client   # tests unitaires et de rendu
```

## Sauvegardes

```bash
npm run backup --workspace=server
```

Crée une copie horodatée de la base SQLite dans `server/backups/` (rétention : 14 dernières). À planifier via `cron` en production, par exemple :

```
0 3 * * * cd /chemin/vers/residence-ops && npm run backup --workspace=server
```

## Déploiement avec Docker

Des `Dockerfile` (client + serveur) et un `docker-compose.yml` sont fournis à la racine.

```bash
cp server/.env.example server/.env   # à remplir avec de vraies valeurs de production
docker compose up --build
```

Le client sera servi sur `http://localhost:8080` (nginx, avec proxy vers l'API et le WebSocket). Les données SQLite, les fichiers uploadés et les sauvegardes sont conservés dans des volumes Docker nommés.

⚠️ Ces fichiers Docker n'ont **pas pu être testés dans cet environnement** (Docker n'y est pas installé) — vérifiez le build sur votre machine avant un déploiement réel.

Pour une mise en ligne publique, il reste à votre charge : un compte chez un hébergeur (Render, Railway, Fly.io, VPS...), un nom de domaine, et la configuration HTTPS — ces étapes nécessitent vos propres identifiants et ne peuvent pas être automatisées.

## Pages

Résident : `/`, `/select`, `/inscription-resident`, `/telecharger`, `/signaler`, `/carte`, `/notifications`, `/actualites`, `/suggestions`, `/profil`, `/ma-carte`, `/restaurant`, `/administration`, `/loisirs`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/confidentialite`, `/conditions`
Gestionnaire : `/admin-login`, `/manager`, `/manager/incidents`, `/manager/planning`, `/manager/analytics`, `/manager/actualites`, `/manager/restaurant`, `/manager/documents`, `/manager/rendez-vous`, `/manager/loisirs`, `/manager/utilisateurs`, `/manager/parametres`

## Fonctionnement du bail vérifié

Un résident peut renseigner un numéro de bail à l'inscription ou depuis son profil : le compte passe alors en statut **« en attente »**. Tant qu'un gestionnaire ne l'a pas validé (Annuaire des utilisateurs → « Baux en attente »), l'accès au signalement d'incidents, aux confirmations, à la carte résident, au restaurant et à l'espace administratif reste bloqué (lecture seule).

## Marque blanche (multi-client)

Chaque résidence peut personnaliser son nom affiché, son logo et sa couleur principale depuis **Paramètres** (côté gestionnaire), si son `plan` est `premium` (`standard` par défaut). Le changement de plan n'est pas en libre-service dans l'interface — c'est un réglage commercial, à faire évoluer en base de données ou via une future page de facturation.

## Carte résident et porte-monnaie

Une carte numérique (QR code + solde) est créée automatiquement dès qu'un bail est vérifié. Le personnel peut créditer le solde depuis l'Annuaire des utilisateurs ; le résident peut ensuite l'utiliser pour régler ses réservations au restaurant.

## RGPD

Voir `docs/legal/README.md` pour le détail des mesures techniques déjà en place (consentement horodaté, export des données, anonymisation de compte) et des modèles de documents fournis (registre des traitements, DPA, procédure de violation) — **à faire relire par un juriste avant usage commercial réel.**

## Limites connues

- Pas de compte d'hébergement ni de nom de domaine configurés (voir section Déploiement).
- Pas d'application native sur l'App Store / Google Play — la PWA installable couvre l'usage mobile.
- Images Docker non testées faute de Docker installé dans l'environnement de développement.
- Pas de purge automatique des données au-delà des durées de conservation documentées (aucun scheduler dans le projet à ce jour) — à mettre en place avant une exploitation commerciale réelle.
- Le porte-monnaie est un crédit interne, non un moyen de paiement bancaire réel (aucune intégration de paiement en ligne).
