# Accord de sous-traitance (DPA) — Modèle

*Modèle de travail à adapter et faire relire par un juriste avant signature. Basé sur la structure attendue par l'article 28 du RGPD.*

**Entre :**
- **[Nom de la résidence / du CROUS]**, ci-après le « Responsable de traitement » ou « Client »
- **[Votre société / raison sociale]**, éditeur de l'application Résidence Ops, ci-après le « Sous-traitant »

## Article 1 — Objet

Le Sous-traitant fournit au Client une plateforme logicielle (« Résidence Ops ») permettant la gestion des incidents,
communications et services de vie en résidence. Dans ce cadre, le Sous-traitant traite pour le compte du Client des
données à caractère personnel relatives aux résidents et au personnel du Client.

## Article 2 — Nature et finalité du traitement

Voir le registre des traitements (`registre-traitements.md`) en annexe, qui liste les catégories de données traitées
et leurs finalités.

## Article 3 — Durée

Le présent accord s'applique pendant toute la durée du contrat de service liant les parties, et jusqu'à la
suppression ou restitution complète des données à son terme (article 7).

## Article 4 — Obligations du Sous-traitant

Le Sous-traitant s'engage à :
1. Ne traiter les données que sur instruction documentée du Client ;
2. Garantir la confidentialité des données (accès restreint par rôle, mots de passe hachés) ;
3. Mettre en œuvre les mesures de sécurité décrites en annexe technique (chiffrement des mots de passe, limitation
   des tentatives de connexion, sauvegardes régulières) ;
4. Notifier le Client de toute violation de données dans les meilleurs délais et au plus tard 48h après en avoir eu
   connaissance (voir `procedure-violation-donnees.md`) ;
5. Assister le Client pour répondre aux demandes d'exercice de droits des personnes concernées (l'application fournit
   nativement l'export et l'anonymisation en un clic pour le résident lui-même) ;
6. Ne pas recourir à un sous-traitant ultérieur (hébergeur, service d'envoi d'email) sans autorisation préalable du
   Client, et s'assurer que ce sous-traitant ultérieur présente des garanties équivalentes ;
7. Supprimer ou restituer toutes les données à la fin du contrat, selon le choix du Client.

## Article 5 — Obligations du Client

Le Client s'engage à :
1. Fournir des instructions licites et documentées ;
2. S'assurer que la collecte des données auprès des résidents respecte les obligations d'information (affichage de
   la politique de confidentialité, recueil du consentement à l'inscription — déjà intégré à l'application) ;
3. Être le point de contact des résidents pour l'exercice de leurs droits (le Sous-traitant fournissant les outils
   techniques nécessaires).

## Article 6 — Sous-traitants ultérieurs

Liste des sous-traitants ultérieurs utilisés par la plateforme (à mettre à jour selon l'hébergement choisi en
production) :
- Hébergement de la base de données et des fichiers : **[à compléter — nom de l'hébergeur retenu]**
- Envoi d'emails transactionnels (réinitialisation de mot de passe) : **[à compléter — fournisseur SMTP retenu]**
- Notifications push : infrastructure Web Push standard (Mozilla/Google/Apple selon le navigateur du résident, sans
  transmission du contenu des messages, uniquement leur acheminement chiffré).

## Article 7 — Sort des données en fin de contrat

Au choix du Client, au terme du contrat : (a) restitution de l'export complet des données, ou (b) suppression
définitive de l'instance et de ses données dans un délai de **[à compléter, ex. 30 jours]**.

## Annexe — Mesures de sécurité techniques

- Mots de passe utilisateurs hachés (bcrypt), jamais stockés en clair.
- Jetons de session signés, limités dans le temps.
- Limitation du nombre de tentatives de connexion (protection contre les attaques par force brute).
- Base de données non exposée directement sur Internet, accessible uniquement via l'API applicative.
- Sauvegardes régulières (voir procédure de sauvegarde du projet).

---

*Signatures :*

Pour le Client : ______________________     Pour le Sous-traitant : ______________________
