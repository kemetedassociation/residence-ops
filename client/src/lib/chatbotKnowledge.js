// Lightweight, fully client-side intent matching for the in-app assistant.
// No external API/key is required — this trades open-ended understanding for a
// guaranteed-to-work, zero-configuration guide that can navigate the user around
// the app and answer the most common questions for their role.

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip accents so "réserver" matches "reserver"
}

function scoreIntent(intent, normalizedInput) {
  let score = 0;
  for (const keyword of intent.keywords) {
    if (normalizedInput.includes(normalize(keyword))) score += keyword.split(" ").length;
  }
  return score;
}

export function matchIntent(input, intents) {
  const normalized = normalize(input);
  let best = null;
  let bestScore = 0;
  for (const intent of intents) {
    const score = scoreIntent(intent, normalized);
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return bestScore > 0 ? best : null;
}

export const RESIDENT_INTENTS = [
  {
    id: "signaler",
    keywords: ["signaler", "fuite", "panne", "probleme", "incident", "casse", "electricite", "bruit", "securite", "reparation"],
    route: "/signaler",
    routeLabel: "Signaler un incident",
    reply: "Vous pouvez signaler un incident (fuite, panne, bruit, sécurité...) directement depuis l'application. Je vous y emmène.",
  },
  {
    id: "carte-batiment",
    keywords: ["carte de la residence", "carte des batiments", "plan de la residence", "quel batiment", "ou se trouve", "etage du batiment"],
    route: "/carte",
    routeLabel: "Carte de la résidence",
    reply: "La carte de la résidence affiche les bâtiments et les incidents en cours par zone. Direction la carte.",
  },
  {
    id: "notifications",
    keywords: ["notification", "alerte", "message recu"],
    route: "/notifications",
    routeLabel: "Notifications",
    reply: "Vos notifications récapitulent les mises à jour de vos signalements et les infos importantes. Je les affiche.",
  },
  {
    id: "actualites",
    keywords: ["actualite", "actu", "nouvelle", "info residence", "annonce"],
    route: "/actualites",
    routeLabel: "Actualités",
    reply: "Toutes les annonces de la résidence sont dans les actualités. Je vous y conduis.",
  },
  {
    id: "suggestions",
    keywords: ["suggestion", "idee", "boite a idees", "proposer"],
    route: "/suggestions",
    routeLabel: "Boîte à idées",
    reply: "Vous pouvez proposer une idée d'amélioration dans la boîte à idées, visible par toute la communauté.",
  },
  {
    id: "carte-solde",
    keywords: ["solde", "porte monnaie", "carte resident", "argent", "qr code", "recharge", "credit"],
    route: "/ma-carte",
    routeLabel: "Ma carte",
    reply: "Votre carte résident affiche votre solde, votre QR code et l'historique de vos transactions. Je vous y amène.",
  },
  {
    id: "restaurant",
    keywords: ["menu", "repas", "restaurant", "manger", "reserver un plat", "diner", "dejeuner", "cantine"],
    route: "/restaurant",
    routeLabel: "Restaurant",
    reply: "Le menu de la semaine et les réservations de repas sont dans l'onglet Restaurant.",
  },
  {
    id: "administration",
    keywords: ["document", "attestation", "avis d'echeance", "rendez vous", "rdv", "administratif", "demarche"],
    route: "/administration",
    routeLabel: "Administration",
    reply: "Vous pouvez demander un document ou réserver un rendez-vous avec le personnel depuis l'espace Administration.",
  },
  {
    id: "loisirs",
    keywords: ["activite", "loisir", "sport", "soiree", "jeux", "tournoi", "planning des activites"],
    route: "/loisirs",
    routeLabel: "Loisirs",
    reply: "Le planning des activités (sport, jeux, soirées...) est dans l'onglet Loisirs.",
  },
  {
    id: "bail",
    keywords: ["bail", "verification", "verifier mon compte", "acces limite", "bloque"],
    route: "/profil",
    routeLabel: "Mon profil",
    reply:
      "Un accès complet nécessite un numéro de bail vérifié par la gestion. Ajoutez-le depuis votre profil si vous ne l'avez pas encore fait — la vérification est faite par le gestionnaire.",
  },
  {
    id: "mot-de-passe",
    keywords: ["mot de passe", "identifiant", "connexion", "login", "mdp oublie"],
    route: "/profil",
    routeLabel: "Mon profil",
    reply: "Vous pouvez changer vos informations depuis votre profil. Pour un mot de passe oublié, utilisez le lien dédié sur l'écran de connexion.",
  },
  {
    id: "donnees-personnelles",
    keywords: ["donnees personnelles", "rgpd", "supprimer mon compte", "exporter mes donnees", "confidentialite"],
    route: "/profil",
    routeLabel: "Mon profil",
    reply: "Vous pouvez exporter ou demander l'effacement de vos données personnelles depuis votre profil, section « Mes données ».",
  },
  {
    id: "salutation",
    keywords: ["bonjour", "salut", "hello", "coucou", "aide", "que peux tu faire"],
    reply:
      "Bonjour ! Je peux vous aider à signaler un incident, consulter votre carte et votre solde, réserver un repas, gérer vos démarches administratives, découvrir les loisirs ou répondre à vos questions sur l'application. Que souhaitez-vous faire ?",
  },
];

export const MANAGER_INTENTS = [
  {
    id: "dashboard",
    keywords: ["tableau de bord", "dashboard", "vue d'ensemble", "accueil"],
    route: "/manager",
    routeLabel: "Dashboard",
    reply: "Le tableau de bord résume les incidents actifs, les urgences et les tendances. Je vous y emmène.",
  },
  {
    id: "incidents",
    keywords: ["incident", "signalement", "combien d'incidents", "urgent"],
    route: "/manager/incidents",
    routeLabel: "Incidents",
    reply: "La liste complète des incidents, avec recherche et filtres, est dans l'onglet Incidents.",
  },
  {
    id: "planning",
    keywords: ["intervention", "planning", "technicien", "planifier"],
    route: "/manager/planning",
    routeLabel: "Planning",
    reply: "Vous pouvez planifier et suivre les interventions techniques dans l'onglet Planning.",
  },
  {
    id: "analytics",
    keywords: ["statistique", "analytics", "graphique", "tendance", "temps de resolution"],
    route: "/manager/analytics",
    routeLabel: "Analytics",
    reply: "Les statistiques et graphiques de la résidence sont dans l'onglet Analytics.",
  },
  {
    id: "actualites-manager",
    keywords: ["actualite", "publier une annonce", "actu"],
    route: "/manager/actualites",
    routeLabel: "Actualités",
    reply: "Vous pouvez publier ou modifier une actualité depuis l'onglet Actualités.",
  },
  {
    id: "restaurant-manager",
    keywords: ["menu", "repas", "restaurant", "reservation de repas"],
    route: "/manager/restaurant",
    routeLabel: "Restaurant",
    reply: "La gestion des menus et l'agrégat des réservations sont dans l'onglet Restaurant.",
  },
  {
    id: "documents-manager",
    keywords: ["document", "attestation", "demande de document"],
    route: "/manager/documents",
    routeLabel: "Documents",
    reply: "Les demandes de documents à traiter sont listées dans l'onglet Documents.",
  },
  {
    id: "rdv-manager",
    keywords: ["rendez vous", "rdv", "disponibilite", "creneau"],
    route: "/manager/rendez-vous",
    routeLabel: "Rendez-vous",
    reply: "Vous pouvez publier vos créneaux disponibles et voir les rendez-vous réservés dans l'onglet Rendez-vous.",
  },
  {
    id: "loisirs-manager",
    keywords: ["activite", "loisir", "planning des loisirs"],
    route: "/manager/loisirs",
    routeLabel: "Loisirs",
    reply: "La gestion du planning des loisirs se fait depuis l'onglet Loisirs.",
  },
  {
    id: "utilisateurs",
    keywords: ["utilisateur", "resident", "bail", "annuaire", "verifier un bail", "solde d'un resident"],
    route: "/manager/utilisateurs",
    routeLabel: "Utilisateurs",
    reply: "L'annuaire des utilisateurs permet de vérifier les baux en attente et de gérer le solde des cartes résident.",
  },
  {
    id: "parametres",
    keywords: ["parametre", "marque", "logo", "couleur", "batiment", "residence", "personnalisation"],
    route: "/manager/parametres",
    routeLabel: "Paramètres",
    reply: "La personnalisation de la marque et la gestion des bâtiments se font dans Paramètres.",
  },
  {
    id: "salutation-manager",
    keywords: ["bonjour", "salut", "hello", "aide", "que peux tu faire"],
    reply:
      "Bonjour ! Je peux vous aider à naviguer entre le tableau de bord, les incidents, le planning, les analytics, le restaurant, les documents, les rendez-vous, les loisirs, l'annuaire ou les paramètres. Que cherchez-vous ?",
  },
];

export const FALLBACK_REPLY =
  "Je n'ai pas bien compris votre demande. Essayez par exemple « signaler une fuite », « voir mon solde » ou « où sont les menus du restaurant ».";
export const FALLBACK_REPLY_MANAGER =
  "Je n'ai pas bien compris votre demande. Essayez par exemple « voir les incidents », « planning des interventions » ou « gérer les utilisateurs ».";
