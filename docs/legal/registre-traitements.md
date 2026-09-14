# Registre des traitements — Résidence Ops

*Modèle de travail — art. 30 RGPD. À faire relire par un juriste avant usage officiel.*

Dernière mise à jour : à renseigner à chaque modification.

## 1. Gestion des comptes et de l'identité résidente

- **Finalité** : création et gestion du compte utilisateur, vérification du bail.
- **Données** : nom, email, téléphone, bâtiment, chambre, numéro de bail, statut de vérification.
- **Base légale** : exécution du contrat (accès au service).
- **Destinataires** : personnel de la résidence (gestionnaire) ; l'éditeur de l'application (sous-traitant technique).
- **Durée de conservation** : durée de résidence + 3 ans (preuve en cas de litige), sauf demande d'effacement anticipée.
- **Mesures de sécurité** : mot de passe haché (bcrypt), accès restreint par rôle, limitation des tentatives de connexion.

## 2. Signalement et suivi d'incidents

- **Finalité** : signalement, confirmation communautaire et résolution des incidents de maintenance/sécurité.
- **Données** : description, catégorie, priorité, photos éventuelles, identité du déclarant, confirmations d'autres résidents.
- **Base légale** : intérêt légitime (bon fonctionnement et sécurité de la résidence).
- **Destinataires** : personnel technique et gestion de la résidence.
- **Durée de conservation** : conservé pour l'historique de maintenance du bâtiment ; anonymisé si le compte du déclarant est effacé (voir section effacement).

## 3. Notifications (in-app et push)

- **Finalité** : informer les résidents des mises à jour concernant leurs signalements, actualités, interventions.
- **Données** : contenu de la notification, statut de lecture, identifiant technique d'abonnement push (endpoint navigateur).
- **Base légale** : exécution du contrat / consentement explicite pour le push natif (activé volontairement par le résident).
- **Durée de conservation** : historique conservé avec le compte ; abonnement push supprimé à la désinscription ou à l'effacement du compte.

## 4. Suggestions et avis de satisfaction

- **Finalité** : recueil d'idées d'amélioration et d'avis après résolution d'incident.
- **Données** : message, note (1-5), identité de l'auteur (masquée pour les autres résidents, visible par la gestion).
- **Base légale** : intérêt légitime (amélioration du service).
- **Durée de conservation** : durée de résidence + 3 ans.

## 5. Demandes d'exercice de droits RGPD

- **Finalité** : traçabilité des demandes d'export et d'effacement, preuve de leur traitement (art. 30 — accountability).
- **Données** : type de demande, date, statut.
- **Base légale** : obligation légale.
- **Durée de conservation** : durée de conservation du compte concerné.

---

## Traitements à ajouter au fil des prochaines fonctionnalités

*(sections à compléter lors de leur mise en production — laissées ici comme rappel de suivi)*

- [ ] Porte-monnaie interne et historique de transactions (données financières internes, non bancaires)
- [ ] Réservations de repas
- [ ] Demandes de documents administratifs (peut inclure des données sensibles selon le document demandé — à vérifier au cas par cas, ex. une attestation ne doit pas révéler de données de santé)
- [ ] Prise de rendez-vous avec le personnel
- [ ] Inscriptions aux activités de loisirs
