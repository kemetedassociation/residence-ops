# Documents RGPD — à lire avant utilisation

⚠️ **Avertissement important** : les documents de ce dossier sont des **modèles de travail**, rédigés pour vous faire
gagner du temps et structurer votre démarche de conformité. Ils **ne constituent pas un avis juridique** et je (l'IA
qui les a rédigés) ne peux pas certifier une conformité légale réelle. Avant toute mise en production commerciale
auprès de vrais clients (CROUS, résidences), faites relire ces documents par un avocat spécialisé en droit du
numérique / protection des données, ou par un DPO externe qualifié.

## Contenu de ce dossier

| Fichier | À quoi ça sert |
|---|---|
| `registre-traitements.md` | Registre des traitements (obligatoire, art. 30 RGPD) — liste les données que Résidence Ops traite, pourquoi, combien de temps. Pré-rempli avec les traitements déjà identifiés dans le code ; à compléter à chaque nouvelle fonctionnalité. |
| `dpa-sous-traitant.md` | Modèle d'accord de sous-traitance (DPA) à faire signer avec **chaque client** (CROUS, résidence) qui utilise Résidence Ops. Vous (l'éditeur) êtes sous-traitant ; le client est responsable de traitement. |
| `procedure-violation-donnees.md` | Marche à suivre en cas de fuite/violation de données (délai de 72h envers la CNIL, notification des personnes concernées). |

## Ce qui est déjà techniquement en place dans l'application

- Consentement horodaté enregistré à l'inscription (`consents`)
- Export des données personnelles au format structuré (droit à la portabilité)
- Anonymisation de compte sur demande (droit à l'effacement)
- Journal des demandes d'export/effacement traitées (`data_requests`), pour prouver que vous répondez aux demandes
- Mots de passe hachés, limitation des tentatives de connexion, accès aux données restreint par rôle

## Ce qui reste à faire de votre côté (non automatisable)

- Désigner un DPO (Délégué à la Protection des Données) si vous y êtes tenu (dépend de votre volume de données/activité — à vérifier avec un juriste), ou un point de contact RGPD à défaut.
- Faire signer le DPA (voir `dpa-sous-traitant.md`) avec chaque client avant le déploiement de leur instance.
- Choisir un hébergeur pour la production et vérifier qu'il propose lui-même les garanties RGPD nécessaires (localisation UE, DPA hébergeur).
- Déclarer/documenter le registre des traitements de façon vivante (le mettre à jour à chaque nouvelle fonctionnalité collectant des données, ex. porte-monnaie, documents administratifs).
- Définir une durée de conservation précise et l'appliquer réellement (purge automatique) — actuellement documentée dans la politique de confidentialité mais pas encore purgée automatiquement en base (aucun scheduler n'existe dans le projet à ce jour).
