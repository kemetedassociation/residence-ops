// Reconnaissance d'intentions entièrement côté client — pas d'API externe, pas de clé requise.
// Tolère les fautes de frappe/orthographe (distance de Levenshtein) et reconnaît de nombreuses
// variantes de formulation par intention, pour qu'une question posée « à sa façon » soit comprise.

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents : "réserver" matche "reserver"
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distance de Levenshtein (nombre minimal de lettres à changer) — mesure la "ressemblance" entre
// deux mots, pour tolérer les fautes de frappe (ex. "rezidance", "chambre" vs "chambres").
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

// Tolérance proportionnelle à la longueur du mot : un mot court n'autorise qu'une petite erreur,
// un mot long peut en tolérer davantage, sans jamais accepter un mot trop différent.
function wordsMatch(a, b) {
  if (a === b) return true;
  // Les mots d'une lettre ("a", "y"...) sont trop courts pour être comparés par ressemblance :
  // sinon ils "matcheraient" par hasard presque n'importe quel mot plus long qui les contient.
  if (a.length < 2 || b.length < 2) return false;
  if (a.includes(b) || b.includes(a)) {
    // Un mot de 2 lettres est lui aussi exclu de la simple inclusion, sinon "ce" matcherait
    // "residen-CE" ou "du" n'importe quel mot qui le contient par hasard.
    if (Math.min(a.length, b.length) < 3) return false;
    return true;
  }
  if (Math.abs(a.length - b.length) > 3) return false;
  const tolerance = b.length <= 4 ? 1 : b.length <= 8 ? 2 : 3;
  return levenshtein(a, b) <= tolerance;
}

function phraseMatches(inputWords, phrase) {
  const phraseWords = normalize(phrase).split(" ").filter(Boolean);
  return phraseWords.every((pw) => inputWords.some((iw) => wordsMatch(iw, pw)));
}

function scoreIntent(intent, inputWords) {
  let score = 0;
  for (const keyword of intent.keywords) {
    if (phraseMatches(inputWords, keyword)) score += keyword.split(" ").length;
  }
  return score;
}

export function matchIntent(input, intents) {
  const inputWords = normalize(input).split(" ").filter(Boolean);
  if (inputWords.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const intent of intents) {
    const score = scoreIntent(intent, inputWords);
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
    keywords: [
      "signaler", "signalement", "fuite", "panne", "probleme", "incident", "casse", "cassee",
      "electricite", "bruit", "securite", "reparation", "ca fuit", "plafond", "eau", "chauffage",
      "ca marche pas", "ca ne fonctionne pas", "serrure", "porte cassee",
    ],
    route: "/signaler",
    routeLabel: "Signaler un incident",
    reply: "Vous pouvez signaler un incident (fuite, panne, bruit, sécurité...) en quelques étapes. Je vous y emmène.",
  },
  {
    id: "suivi-incident",
    keywords: [
      "suivi de mon signalement", "ou en est mon incident", "statut de mon signalement", "mes signalements",
      "avancement", "resolu", "mon probleme est il regle",
    ],
    route: "/",
    routeLabel: "Accueil — suivi des signalements",
    reply: "Le suivi de vos signalements (signalé, confirmé, en cours, résolu) est sur l'accueil. Je vous y amène.",
  },
  {
    id: "aide-psy",
    keywords: [
      "besoin d'aide", "aide", "psychologue", "psy", "deprime", "depression", "anxiete", "stress",
      "mal etre", "detresse", "parler a quelqu'un", "soutien psychologique", "pas bien", "difficile en ce moment",
      "urgence", "numero d'urgence", "suicide", "3114", "envie de rien", "seul", "isolement",
    ],
    route: "/aide",
    routeLabel: "Besoin d'aide",
    reply:
      "Vous n'êtes pas seul(e). La page « Besoin d'aide » donne les numéros d'urgence et un annuaire de psychologues avec qui prendre rendez-vous en toute confidentialité. Je vous y conduis tout de suite.",
  },
  {
    id: "carte-batiment",
    keywords: [
      "carte de la residence", "carte des batiments", "plan de la residence", "quel batiment",
      "ou se trouve", "etage du batiment", "plan du site", "localisation des batiments",
    ],
    route: "/carte",
    routeLabel: "Carte de la résidence",
    reply: "La carte de la résidence affiche les bâtiments et les incidents en cours par zone. Direction la carte.",
  },
  {
    id: "notifications",
    keywords: ["notification", "alerte", "message recu", "mes notifications", "centre de notifications"],
    route: "/notifications",
    routeLabel: "Notifications",
    reply: "Vos notifications récapitulent les mises à jour de vos signalements et les infos importantes. Je les affiche.",
  },
  {
    id: "actualites",
    keywords: ["actualite", "actu", "nouvelle", "info residence", "annonce", "coupure d'eau", "travaux prevus"],
    route: "/actualites",
    routeLabel: "Actualités",
    reply: "Toutes les annonces de la résidence sont dans les actualités. Je vous y conduis.",
  },
  {
    id: "suggestions",
    keywords: ["suggestion", "idee", "boite a idees", "proposer", "ameliorer la residence"],
    route: "/suggestions",
    routeLabel: "Boîte à idées",
    reply: "Vous pouvez proposer une idée d'amélioration dans la boîte à idées, visible par toute la communauté.",
  },
  {
    id: "carte-solde",
    keywords: [
      "solde", "porte monnaie", "carte resident", "argent", "qr code", "recharge", "credit",
      "payer en ligne", "carte bancaire", "combien j'ai", "recharger ma carte",
    ],
    route: "/ma-carte",
    routeLabel: "Ma carte",
    reply: "Votre carte résident affiche votre solde, votre QR code et permet de recharger par carte bancaire. Je vous y amène.",
  },
  {
    id: "restaurant",
    keywords: [
      "menu", "repas", "restaurant", "manger", "reserver un plat", "diner", "dejeuner", "cantine",
      "qu'est ce qu'on mange", "menu de la semaine",
    ],
    route: "/restaurant",
    routeLabel: "Restaurant",
    reply: "Le menu de la semaine et les réservations de repas sont dans l'onglet Restaurant.",
  },
  {
    id: "documents",
    keywords: [
      "document", "attestation", "avis d'echeance", "justificatif", "papier administratif",
      "demander un document", "attestation de residence",
    ],
    route: "/administration?tab=documents",
    routeLabel: "Administration — Documents",
    reply: "Vous pouvez demander une attestation ou tout autre document depuis l'onglet Documents de l'Administration.",
  },
  {
    id: "rdv-administratif",
    keywords: [
      "rendez vous administratif", "rendez vous avec la gestion", "rendez vous au bureau", "rendez vous",
      "rdv", "creneau", "disponibilite", "prendre rendez vous",
    ],
    route: "/administration?tab=rdv",
    routeLabel: "Administration — Rendez-vous",
    reply: "Vous pouvez réserver un créneau avec la gestion depuis le calendrier de l'onglet Rendez-vous.",
  },
  {
    id: "loisirs",
    keywords: ["activite", "loisir", "sport", "soiree", "jeux", "tournoi", "planning des activites", "yoga"],
    route: "/loisirs",
    routeLabel: "Loisirs",
    reply: "Le planning des activités (sport, jeux, soirées...) est dans l'onglet Loisirs.",
  },
  {
    id: "installer-app",
    keywords: ["installer l'application", "telecharger l'app", "ajouter a l'ecran d'accueil", "application mobile"],
    route: "/telecharger",
    routeLabel: "Installer l'application",
    reply: "Vous pouvez installer Résidence Ops comme une application, sur téléphone ou ordinateur. Je vous montre comment.",
  },
  {
    id: "bail",
    keywords: ["bail", "verification", "verifier mon compte", "acces limite", "bloque", "numero de bail"],
    route: "/profil",
    routeLabel: "Mon profil",
    reply:
      "Un accès complet nécessite un numéro de bail vérifié par la gestion. Ajoutez-le depuis votre profil si vous ne l'avez pas encore fait — la vérification est faite par le gestionnaire.",
  },
  {
    id: "mot-de-passe",
    keywords: ["mot de passe", "identifiant", "connexion", "login", "mdp oublie", "changer mon mot de passe"],
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
    keywords: ["bonjour", "salut", "hello", "coucou", "aide moi", "que peux tu faire", "qui es tu"],
    reply:
      "Bonjour, je suis Isis 👋 Je peux vous aider à signaler un incident, consulter votre carte et votre solde, réserver un repas, gérer vos démarches, trouver un psychologue ou découvrir les loisirs. Que souhaitez-vous faire ?",
  },
];

// `module` relie chaque intention à une permission (voir server STAFF_MODULES) — Isis ne propose
// que les sections que la personne connectée peut réellement utiliser. `null` = toujours proposé.
export const MANAGER_INTENTS = [
  {
    id: "dashboard",
    module: null,
    keywords: ["tableau de bord", "dashboard", "vue d'ensemble", "accueil", "resume"],
    route: "/manager",
    routeLabel: "Dashboard",
    reply: "Le tableau de bord résume les incidents actifs, les urgences et les tendances. Je vous y emmène.",
  },
  {
    id: "notifications-manager",
    module: null,
    keywords: ["notification", "alerte", "mes notifications"],
    route: "/manager/notifications",
    routeLabel: "Notifications",
    reply: "Vos notifications (nouvelles demandes, réservations...) sont dans le centre de notifications.",
  },
  {
    id: "incidents",
    module: "incidents",
    keywords: ["incident", "signalement", "combien d'incidents", "urgent", "liste des incidents"],
    route: "/manager/incidents",
    routeLabel: "Incidents",
    reply: "La liste complète des incidents, avec recherche et filtres, est dans l'onglet Incidents.",
  },
  {
    id: "planning",
    module: "incidents",
    keywords: ["intervention", "planning", "technicien", "planifier une intervention"],
    route: "/manager/planning",
    routeLabel: "Planning",
    reply: "Vous pouvez planifier et suivre les interventions techniques dans l'onglet Planning.",
  },
  {
    id: "analytics",
    module: null,
    keywords: ["statistique", "analytics", "graphique", "tendance", "temps de resolution"],
    route: "/manager/analytics",
    routeLabel: "Analytics",
    reply: "Les statistiques et graphiques de la résidence sont dans l'onglet Analytics.",
  },
  {
    id: "actualites-manager",
    module: "actualites",
    keywords: ["actualite", "publier une annonce", "actu", "ecrire une annonce"],
    route: "/manager/actualites",
    routeLabel: "Actualités",
    reply: "Vous pouvez publier ou modifier une actualité depuis l'onglet Actualités.",
  },
  {
    id: "restaurant-manager",
    module: "restaurant",
    keywords: ["menu", "repas", "restaurant", "reservation de repas", "gerer les menus"],
    route: "/manager/restaurant",
    routeLabel: "Restaurant",
    reply: "La gestion des menus et l'agrégat des réservations sont dans l'onglet Restaurant.",
  },
  {
    id: "documents-manager",
    module: "documents",
    keywords: ["document", "attestation", "demande de document", "traiter un document"],
    route: "/manager/documents",
    routeLabel: "Documents",
    reply: "Les demandes de documents à traiter sont listées dans l'onglet Documents.",
  },
  {
    id: "rdv-manager",
    module: "rendez_vous",
    keywords: ["rendez vous", "rdv", "disponibilite", "creneau", "publier un creneau"],
    route: "/manager/rendez-vous",
    routeLabel: "Rendez-vous",
    reply: "Vous pouvez publier vos créneaux disponibles et voir les rendez-vous réservés dans l'onglet Rendez-vous.",
  },
  {
    id: "loisirs-manager",
    module: "loisirs",
    keywords: ["activite", "loisir", "planning des loisirs", "organiser une activite"],
    route: "/manager/loisirs",
    routeLabel: "Loisirs",
    reply: "La gestion du planning des loisirs se fait depuis l'onglet Loisirs.",
  },
  {
    id: "utilisateurs",
    module: "utilisateurs",
    keywords: [
      "utilisateur", "resident", "bail", "annuaire", "verifier un bail", "solde d'un resident",
      "liste des residents", "crediter un compte",
    ],
    route: "/manager/utilisateurs",
    routeLabel: "Utilisateurs",
    reply: "L'annuaire des utilisateurs permet de vérifier les baux en attente et de gérer le solde des cartes résident.",
  },
  {
    id: "accompagnement",
    module: "accompagnement",
    keywords: ["psychologue", "accompagnement", "aide psychologique", "annuaire des psychologues", "ajouter un psychologue"],
    route: "/manager/accompagnement",
    routeLabel: "Accompagnement",
    reply: "L'annuaire des psychologues (ajout, invitation) se gère depuis l'onglet Accompagnement.",
  },
  {
    id: "paiements-manager",
    module: "paiements",
    keywords: ["paiement", "stripe", "mollie", "paypal", "helloasso", "moyen de paiement", "encaisser"],
    route: "/manager/paiements",
    routeLabel: "Paiements",
    reply: "L'activation et la configuration des moyens de paiement en ligne se font dans l'onglet Paiements.",
  },
  {
    id: "equipe",
    module: "gestion_comptes",
    keywords: [
      "equipe", "acces", "permission", "ajouter un administrateur", "ajouter un technicien",
      "creer un compte", "suspendre un compte", "gerer les comptes",
    ],
    route: "/manager/equipe",
    routeLabel: "Équipe et accès",
    reply: "La création de comptes et la gestion de leurs permissions se font dans l'onglet Équipe et accès.",
  },
  {
    id: "erreurs",
    module: "erreurs",
    keywords: ["erreur", "bug", "plantage", "journal des erreurs"],
    route: "/manager/erreurs",
    routeLabel: "Erreurs",
    reply: "Le journal des erreurs applicatives récentes est dans l'onglet Erreurs.",
  },
  {
    id: "parametres",
    module: "parametres",
    keywords: ["parametre", "marque", "logo", "couleur", "batiment", "residence", "personnalisation"],
    route: "/manager/parametres",
    routeLabel: "Paramètres",
    reply: "La personnalisation de la marque et la gestion des bâtiments se font dans Paramètres.",
  },
  {
    id: "salutation-manager",
    module: null,
    keywords: ["bonjour", "salut", "hello", "aide moi", "que peux tu faire", "qui es tu"],
    reply:
      "Bonjour, je suis Isis 👋 Je peux vous aider à naviguer entre le tableau de bord, les incidents, le restaurant, les documents, les rendez-vous, les loisirs, l'accompagnement, les paiements, l'équipe ou les paramètres. Que cherchez-vous ?",
  },
];

export const FALLBACK_REPLY =
  "Je n'ai pas bien compris votre demande. Essayez par exemple « signaler une fuite », « voir mon solde », « parler à un psychologue » ou « menu du restaurant ».";
export const FALLBACK_REPLY_MANAGER =
  "Je n'ai pas bien compris votre demande, ou vous n'avez pas accès à cette section. Essayez par exemple « voir les incidents », « gérer les paiements » ou « gérer l'équipe ».";
