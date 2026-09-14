# Procédure en cas de violation de données personnelles

*Modèle de travail à adapter. Basé sur les obligations des articles 33 et 34 du RGPD.*

Une « violation de données » est tout incident de sécurité entraînant, de manière accidentelle ou illicite, la
destruction, la perte, l'altération, la divulgation ou l'accès non autorisé à des données personnelles (ex. : fuite
de la base de données, compte administrateur compromis, erreur exposant des données à la mauvaise personne).

## Étape 1 — Détection et confinement (immédiat)

1. Isoler la source (couper l'accès compromis, changer les identifiants concernés, ex. `JWT_SECRET`).
2. Évaluer l'étendue : quelles tables/utilisateurs sont concernés ? Combien de personnes ?
3. Consigner l'heure de détection — le délai de 72h (étape 3) court à partir de ce moment.

## Étape 2 — Analyse

- Quelle catégorie de données est concernée (identité, financière via le porte-monnaie, documents administratifs) ?
- Le risque pour les personnes est-il faible, élevé ? (ex. simple fuite de noms vs fuite de mots de passe — ces
  derniers sont hachés, donc le risque direct est limité, mais reste à évaluer).

## Étape 3 — Notification à la CNIL (dans les 72h si risque pour les personnes)

Se rendre sur [https://notifications.cnil.fr](https://www.cnil.fr) et déclarer via le téléservice officiel. Informations à préparer :
- Nature de la violation
- Catégories et nombre approximatif de personnes concernées
- Conséquences probables
- Mesures prises ou envisagées

## Étape 4 — Notification aux personnes concernées (si risque élevé)

Si la violation présente un risque élevé pour les droits et libertés des résidents (ex. fuite de données financières
ou de documents administratifs sensibles), les personnes concernées doivent être informées directement, en langage
clair, avec :
- Description de la violation
- Coordonnées d'un point de contact
- Mesures prises et recommandations (ex. changer son mot de passe)

*Modèle de message :*

> Objet : Information sur un incident de sécurité concernant vos données
>
> Bonjour [Prénom],
>
> Nous vous informons qu'un incident de sécurité a affecté [description synthétique]. Les données concernées sont
> [catégories]. Nous avons pris les mesures suivantes : [mesures]. Nous vous recommandons de [action recommandée,
> ex. changer votre mot de passe]. Pour toute question : [contact].

## Étape 5 — Documentation interne

Consigner l'incident dans un registre des violations (même les violations non notifiées à la CNIL doivent être
documentées en interne) : date, description, personnes concernées, mesures prises, décision de notifier ou non et
pourquoi.

## Étape 6 — Retour d'expérience

Une fois l'incident clos, revoir les mesures techniques pour éviter la récidive (ex. rotation des secrets, audit des
accès, renforcement de la limitation de tentatives de connexion).
