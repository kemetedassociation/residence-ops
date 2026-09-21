import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { getOrCreateCard, applyWalletTransaction } from "../lib/wallet.js";

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

const TABLES = [
  "activities",
  "appointments",
  "availability_slots",
  "document_requests",
  "meal_reservations",
  "menus",
  "wallet_transactions",
  "resident_cards",
  "data_requests",
  "consents",
  "push_subscriptions",
  "password_resets",
  "confirmations",
  "incident_photos",
  "feedback",
  "notifications",
  "interventions",
  "incidents",
  "users",
  "buildings",
  "residences",
];

export function seed() {
  db.pragma("foreign_keys = OFF");
  TABLES.forEach((t) => db.prepare(`DELETE FROM ${t}`).run());
  db.pragma("foreign_keys = ON");

  const residenceId = nanoid();
  const buildingA = nanoid();
  const buildingB = nanoid();
  const buildingC = nanoid();

  const manager = { id: nanoid() };
  const resident1 = { id: nanoid() };
  const resident2 = { id: nanoid() };
  const resident3 = { id: nanoid() };
  const resident4 = { id: nanoid() };
  const technicien = { id: nanoid() };

  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  const daysFromNow = (n) => new Date(now.getTime() + n * 86400000).toISOString();
  const hoursAgo = (n) => new Date(now.getTime() - n * 3600000).toISOString();

  db.prepare(
    `INSERT INTO residences (id, name, address, city, latitude, longitude, total_buildings, manager_email, created_at)
     VALUES (@id, @name, @address, @city, @latitude, @longitude, @total_buildings, @manager_email, @created_at)`
  ).run({
    id: residenceId,
    name: "Résidence Descartes",
    address: "12 rue Descartes",
    city: "Paris",
    latitude: 48.8462,
    longitude: 2.3486,
    total_buildings: 3,
    manager_email: "manager@residence-ops.fr",
    created_at: daysAgo(400),
  });

  // Démonstration de la marque blanche (Phase 1) : résidence en plan premium avec une identité personnalisée.
  db.prepare("UPDATE residences SET display_name = ?, primary_color = ?, plan = 'premium' WHERE id = ?").run(
    "Résidence Ops — Descartes",
    "#7c3aed",
    residenceId
  );

  const insertBuilding = db.prepare("INSERT INTO buildings (id, residence_id, name, floors) VALUES (?, ?, ?, ?)");
  insertBuilding.run(buildingA, residenceId, "Bâtiment A", 5);
  insertBuilding.run(buildingB, residenceId, "Bâtiment B", 4);
  insertBuilding.run(buildingC, residenceId, "Bâtiment C", 6);

  const insertUser = db.prepare(
    `INSERT INTO users (id, role, name, email, password, phone, residence_id, building_id, room, lease_number, lease_status, created_at)
     VALUES (@id, @role, @name, @email, @password, @phone, @residence_id, @building_id, @room, @lease_number, @lease_status, @created_at)`
  );

  insertUser.run({
    id: manager.id,
    role: "manager",
    name: "Camille Dupont",
    email: "manager@residence-ops.fr",
    password: hash("manager123"),
    phone: "06 12 34 56 78",
    residence_id: residenceId,
    building_id: null,
    room: "",
    lease_number: null,
    lease_status: "none",
    created_at: daysAgo(400),
  });

  insertUser.run({
    id: resident1.id,
    role: "resident",
    name: "Léo Martin",
    email: "etudiant@residence-ops.fr",
    password: hash("resident123"),
    phone: "06 98 76 54 32",
    residence_id: residenceId,
    building_id: buildingA,
    room: "214",
    lease_number: "BAIL-2025-0214",
    lease_status: "verified",
    created_at: daysAgo(120),
  });

  insertUser.run({
    id: resident2.id,
    role: "resident",
    name: "Nina Chevalier",
    email: "nina.chevalier@residence-ops.fr",
    password: hash("resident123"),
    phone: "06 11 22 33 44",
    residence_id: residenceId,
    building_id: buildingB,
    room: "105",
    lease_number: "BAIL-2025-0105",
    lease_status: "verified",
    created_at: daysAgo(90),
  });

  insertUser.run({
    id: resident3.id,
    role: "resident",
    name: "Yanis Bouzid",
    email: "yanis.bouzid@residence-ops.fr",
    password: hash("resident123"),
    phone: "06 55 44 33 22",
    residence_id: residenceId,
    building_id: buildingC,
    room: "302",
    lease_number: "BAIL-2025-0302",
    lease_status: "verified",
    created_at: daysAgo(60),
  });

  insertUser.run({
    id: resident4.id,
    role: "resident",
    name: "Sofia Rossi",
    email: "sofia.rossi@residence-ops.fr",
    password: hash("resident123"),
    phone: "06 20 20 20 20",
    residence_id: residenceId,
    building_id: buildingA,
    room: "",
    lease_number: "BAIL-2025-9999",
    lease_status: "pending",
    created_at: daysAgo(2),
  });

  insertUser.run({
    id: technicien.id,
    role: "technicien",
    name: "Marc Lefèvre",
    email: "marc.lefevre@residence-ops.fr",
    password: hash("technicien123"),
    phone: "06 77 88 99 00",
    residence_id: residenceId,
    building_id: null,
    room: "",
    lease_number: null,
    lease_status: "none",
    created_at: daysAgo(200),
  });

  const incidentFuite = nanoid();
  const incidentElec = nanoid();
  const incidentBruit = nanoid();
  const incidentPorte = nanoid();
  const incidentChauffage = nanoid();
  const incidentAscenseur = nanoid();

  const insertIncident = db.prepare(
    `INSERT INTO incidents (id, reporter_id, building_id, floor, room, type, title, description, status, priority, confirmation_count, is_validated, assigned_to, created_at, updated_at, resolved_date)
     VALUES (@id, @reporter_id, @building_id, @floor, @room, @type, @title, @description, @status, @priority, @confirmation_count, @is_validated, @assigned_to, @created_at, @updated_at, @resolved_date)`
  );

  insertIncident.run({
    id: incidentFuite,
    reporter_id: resident1.id,
    building_id: buildingA,
    floor: "0",
    room: "Cuisine commune",
    type: "eau",
    title: "Fuite d'eau sous l'évier",
    description: "Fuite d'eau sous l'évier de la cuisine commune, une flaque se forme au sol.",
    status: "resolu",
    priority: "urgent",
    confirmation_count: 3,
    is_validated: 1,
    assigned_to: technicien.id,
    created_at: daysAgo(15),
    updated_at: daysAgo(12),
    resolved_date: daysAgo(12),
  });

  insertIncident.run({
    id: incidentElec,
    reporter_id: resident2.id,
    building_id: buildingB,
    floor: "1",
    room: "Couloir",
    type: "electricite",
    title: "Panne d'électricité au 1er étage",
    description: "Coupure de courant récurrente sur toute la partie couloir du 1er étage.",
    status: "resolu",
    priority: "urgent",
    confirmation_count: 4,
    is_validated: 1,
    assigned_to: technicien.id,
    created_at: daysAgo(20),
    updated_at: daysAgo(18),
    resolved_date: daysAgo(18),
  });

  insertIncident.run({
    id: incidentBruit,
    reporter_id: resident3.id,
    building_id: buildingC,
    floor: "3",
    room: "Couloir",
    type: "bruit",
    title: "Nuisances sonores répétées",
    description: "Nuisances sonores répétées en soirée au 3e étage, plusieurs plaintes de voisins.",
    status: "signale",
    priority: "faible",
    confirmation_count: 1,
    is_validated: 0,
    assigned_to: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
    resolved_date: null,
  });

  insertIncident.run({
    id: incidentPorte,
    reporter_id: resident1.id,
    building_id: buildingA,
    floor: "0",
    room: "Entrée principale",
    type: "securite",
    title: "Porte d'entrée cassée",
    description: "La porte d'entrée principale ne ferme plus correctement, risque de sécurité.",
    status: "confirme",
    priority: "urgent",
    confirmation_count: 2,
    is_validated: 1,
    assigned_to: null,
    created_at: daysAgo(1),
    updated_at: hoursAgo(6),
    resolved_date: null,
  });

  insertIncident.run({
    id: incidentChauffage,
    reporter_id: resident2.id,
    building_id: buildingB,
    floor: "1",
    room: "108",
    type: "autre",
    title: "Radiateur en panne",
    description: "Le radiateur de la chambre 108 ne chauffe plus depuis 3 jours.",
    status: "resolu",
    priority: "normal",
    confirmation_count: 1,
    is_validated: 0,
    assigned_to: technicien.id,
    created_at: daysAgo(10),
    updated_at: daysAgo(7),
    resolved_date: daysAgo(7),
  });

  insertIncident.run({
    id: incidentAscenseur,
    reporter_id: resident3.id,
    building_id: buildingC,
    floor: "0",
    room: "Hall",
    type: "securite",
    title: "Ascenseur bloqué",
    description: "L'ascenseur du Bâtiment C reste bloqué entre le 2e et 3e étage par intermittence.",
    status: "en_cours",
    priority: "urgent",
    confirmation_count: 5,
    is_validated: 1,
    assigned_to: technicien.id,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    resolved_date: null,
  });

  const insertConfirmation = db.prepare("INSERT INTO confirmations (id, incident_id, user_id, created_at) VALUES (?, ?, ?, ?)");
  insertConfirmation.run(nanoid(), incidentFuite, resident2.id, daysAgo(14));
  insertConfirmation.run(nanoid(), incidentFuite, resident3.id, daysAgo(14));
  insertConfirmation.run(nanoid(), incidentPorte, resident2.id, hoursAgo(20));
  insertConfirmation.run(nanoid(), incidentAscenseur, resident1.id, daysAgo(2));
  insertConfirmation.run(nanoid(), incidentAscenseur, resident2.id, daysAgo(2));

  const insertIntervention = db.prepare(
    `INSERT INTO interventions (id, incident_id, technician_id, technician_name, technician_email, scheduled_date, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertIntervention.run(nanoid(), incidentFuite, technicien.id, "Marc Lefèvre", "marc.lefevre@residence-ops.fr", daysAgo(13), "terminee", "Remplacement du siphon effectué.", daysAgo(14));
  insertIntervention.run(nanoid(), incidentElec, technicien.id, "Marc Lefèvre", "marc.lefevre@residence-ops.fr", daysAgo(19), "terminee", "Remplacement du disjoncteur du couloir.", daysAgo(19));
  insertIntervention.run(nanoid(), incidentAscenseur, technicien.id, "Marc Lefèvre", "marc.lefevre@residence-ops.fr", daysFromNow(1), "planifiee", "Diagnostic de la cellule de sécurité de l'ascenseur.", daysAgo(1));
  insertIntervention.run(nanoid(), incidentPorte, technicien.id, "Marc Lefèvre", "marc.lefevre@residence-ops.fr", daysFromNow(2), "planifiee", "Remplacement de la serrure de la porte principale.", hoursAgo(10));
  insertIntervention.run(nanoid(), incidentBruit, technicien.id, "Marc Lefèvre", "marc.lefevre@residence-ops.fr", daysFromNow(3), "planifiee", "Médiation avec les résidents du 3e étage.", daysAgo(1));

  const insertPost = db.prepare(
    `INSERT INTO posts (id, title, content, category, pinned, published, cover_image_url, author_id, published_at)
     VALUES (@id, @title, @content, @category, @pinned, @published, @cover_image_url, @author_id, @published_at)`
  );
  insertPost.run({
    id: nanoid(),
    title: "Coupure d'eau programmée le 20 mars",
    content: "Une coupure d'eau générale aura lieu de 9h à 13h pour des travaux de maintenance sur le réseau. Merci de faire vos réserves à l'avance.",
    category: "travaux",
    pinned: 1,
    published: 1,
    cover_image_url: "https://images.unsplash.com/photo-1493397212122-2b85dda8106b?w=1200&q=70",
    author_id: manager.id,
    published_at: daysAgo(2),
  });
  insertPost.run({
    id: nanoid(),
    title: "Règlement intérieur mis à jour",
    content: "Le règlement intérieur de la résidence a été mis à jour, notamment concernant les horaires de silence. Consultez la nouvelle version à l'accueil.",
    category: "reglementation",
    pinned: 0,
    published: 1,
    cover_image_url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200&q=70",
    author_id: manager.id,
    published_at: daysAgo(10),
  });
  insertPost.run({
    id: nanoid(),
    title: "Travaux de toiture au Bâtiment C",
    content: "Des travaux de réfection de toiture auront lieu au Bâtiment C durant les deux prochaines semaines. Prévoyez un peu de bruit en journée.",
    category: "travaux",
    pinned: 0,
    published: 1,
    cover_image_url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=70",
    author_id: manager.id,
    published_at: daysAgo(15),
  });
  insertPost.run({
    id: nanoid(),
    title: "Bienvenue à la Résidence Descartes",
    content: "Toute l'équipe de gestion vous souhaite la bienvenue. N'hésitez pas à utiliser Résidence Ops pour signaler tout incident ou nous faire part de vos suggestions.",
    category: "information",
    pinned: 0,
    published: 1,
    cover_image_url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=70",
    author_id: manager.id,
    published_at: daysAgo(30),
  });

  const insertFeedback = db.prepare(
    `INSERT INTO feedback (id, user_id, type, title, message, rating, incident_id, created_at)
     VALUES (@id, @user_id, @type, @title, @message, @rating, @incident_id, @created_at)`
  );
  insertFeedback.run({ id: nanoid(), user_id: resident1.id, type: "suggestion", title: "Casiers à colis", message: "Ce serait pratique d'installer des casiers à colis sécurisés à l'entrée du Bâtiment A.", rating: null, incident_id: null, created_at: daysAgo(6) });
  insertFeedback.run({ id: nanoid(), user_id: resident2.id, type: "suggestion", title: "Prises USB", message: "Pourrait-on ajouter des prises USB dans la salle commune du Bâtiment B ?", rating: null, incident_id: null, created_at: daysAgo(20) });
  insertFeedback.run({ id: nanoid(), user_id: resident1.id, type: "satisfaction", title: "", message: "Intervention rapide et efficace, merci !", rating: 5, incident_id: incidentFuite, created_at: daysAgo(12) });
  insertFeedback.run({ id: nanoid(), user_id: resident2.id, type: "satisfaction", title: "", message: "Résolu rapidement.", rating: 4, incident_id: incidentElec, created_at: daysAgo(18) });

  const insertNotif = db.prepare(
    `INSERT INTO notifications (id, user_id, title, message, type, target_building_id, is_read, created_at)
     VALUES (@id, @user_id, @title, @message, @type, @target_building_id, @is_read, @created_at)`
  );
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Intervention planifiée", message: "Un technicien interviendra bientôt pour la porte d'entrée du Bâtiment A.", type: "intervention", target_building_id: buildingA, is_read: 0, created_at: hoursAgo(5) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Incident confirmé", message: "L'incident « Porte d'entrée cassée » a été confirmé par la communauté.", type: "alerte", target_building_id: buildingA, is_read: 0, created_at: hoursAgo(20) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Rappel travaux", message: "Des travaux de toiture débutent cette semaine au Bâtiment C.", type: "info", target_building_id: null, is_read: 0, created_at: daysAgo(1) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Incident résolu", message: "Votre signalement « Fuite d'eau sous l'évier » a été résolu.", type: "resolution", target_building_id: buildingA, is_read: 1, created_at: daysAgo(12) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Nouvelle actualité", message: "Coupure d'eau programmée le 20 mars, consultez les actualités pour plus de détails.", type: "info", target_building_id: null, is_read: 1, created_at: daysAgo(2) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Ascenseur en réparation", message: "Une intervention est en cours sur l'ascenseur du Bâtiment C.", type: "intervention", target_building_id: buildingC, is_read: 1, created_at: daysAgo(2) });
  insertNotif.run({ id: nanoid(), user_id: resident1.id, title: "Bienvenue", message: "Bienvenue sur Résidence Ops ! Signalez vos incidents en un clic.", type: "info", target_building_id: null, is_read: 1, created_at: daysAgo(30) });

  // Carte résident + porte-monnaie (Phase 2) : démonstration pour les résidents au bail vérifié.
  [resident1, resident2, resident3].forEach((resident) => getOrCreateCard(resident.id));
  applyWalletTransaction(getOrCreateCard(resident1.id).id, 2000, "credit", "Recharge à l'accueil", manager.id);
  applyWalletTransaction(getOrCreateCard(resident1.id).id, 350, "debit", "Repas du midi — Restaurant", manager.id);
  applyWalletTransaction(getOrCreateCard(resident2.id).id, 1000, "credit", "Recharge à l'accueil", manager.id);

  // Restaurant (Phase 3) : menus de démonstration pour aujourd'hui et demain.
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const insertMenu = db.prepare(
    `INSERT INTO menus (id, residence_id, menu_date, meal, items, created_by, created_at)
     VALUES (@id, @residence_id, @menu_date, @meal, @items, @created_by, @created_at)`
  );
  const menuMidi = nanoid();
  insertMenu.run({
    id: menuMidi,
    residence_id: residenceId,
    menu_date: today,
    meal: "midi",
    items: JSON.stringify(["Poulet basquaise, riz", "Curry de légumes (végétarien)", "Pâtes bolognaise"]),
    created_by: manager.id,
    created_at: daysAgo(1),
  });
  insertMenu.run({
    id: nanoid(),
    residence_id: residenceId,
    menu_date: today,
    meal: "soir",
    items: JSON.stringify(["Gratin dauphinois", "Salade César"]),
    created_by: manager.id,
    created_at: daysAgo(1),
  });
  insertMenu.run({
    id: nanoid(),
    residence_id: residenceId,
    menu_date: tomorrow,
    meal: "midi",
    items: JSON.stringify(["Bœuf bourguignon", "Falafels et houmous (végétarien)"]),
    created_by: manager.id,
    created_at: daysAgo(1),
  });

  db.prepare(
    `INSERT INTO meal_reservations (id, menu_id, user_id, dish, status, paid_with_card, created_at)
     VALUES (?, ?, ?, ?, 'reservee', 1, ?)`
  ).run(nanoid(), menuMidi, resident1.id, "Poulet basquaise, riz", hoursAgo(3));

  // Espace administratif (Phase 4) : demandes de documents et rendez-vous de démonstration.
  db.prepare(
    `INSERT INTO document_requests (id, user_id, type, note, status, admin_note, file_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), resident1.id, "attestation_residence", "", "demande", "", null, daysAgo(1), daysAgo(1));
  db.prepare(
    `INSERT INTO document_requests (id, user_id, type, note, status, admin_note, file_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(nanoid(), resident2.id, "avis_echeance", "Besoin pour ma banque", "en_traitement", "", null, daysAgo(5), daysAgo(4));

  const insertSlot = db.prepare(
    `INSERT INTO availability_slots (id, staff_user_id, residence_id, start_at, end_at, is_booked, created_at)
     VALUES (@id, @staff_user_id, @residence_id, @start_at, @end_at, @is_booked, @created_at)`
  );
  const bookedSlot = nanoid();
  insertSlot.run({
    id: bookedSlot,
    staff_user_id: manager.id,
    residence_id: residenceId,
    start_at: daysFromNow(1),
    end_at: new Date(new Date(daysFromNow(1)).getTime() + 30 * 60000).toISOString(),
    is_booked: 1,
    created_at: daysAgo(2),
  });
  insertSlot.run({
    id: nanoid(),
    staff_user_id: manager.id,
    residence_id: residenceId,
    start_at: daysFromNow(2),
    end_at: new Date(new Date(daysFromNow(2)).getTime() + 30 * 60000).toISOString(),
    is_booked: 0,
    created_at: daysAgo(2),
  });
  db.prepare(
    "INSERT INTO appointments (id, slot_id, resident_id, note, status, created_at) VALUES (?, ?, ?, ?, 'confirme', ?)"
  ).run(nanoid(), bookedSlot, resident3.id, "Question sur mon dépôt de garantie", daysAgo(2));

  // Loisirs (Phase 5) : planning de démonstration.
  const insertActivity = db.prepare(
    `INSERT INTO activities (id, residence_id, title, description, category, activity_date, start_time, end_time, location, created_by, created_at)
     VALUES (@id, @residence_id, @title, @description, @category, @activity_date, @start_time, @end_time, @location, @created_by, @created_at)`
  );
  insertActivity.run({
    id: nanoid(),
    residence_id: residenceId,
    title: "Tournoi de babyfoot",
    description: "Inscription libre, par équipes de 2.",
    category: "jeux",
    activity_date: today,
    start_time: "19:00",
    end_time: "21:00",
    location: "Salle commune",
    created_by: manager.id,
    created_at: daysAgo(3),
  });
  insertActivity.run({
    id: nanoid(),
    residence_id: residenceId,
    title: "Séance de yoga",
    description: "",
    category: "sport",
    activity_date: tomorrow,
    start_time: "08:00",
    end_time: "09:00",
    location: "Cour intérieure",
    created_by: manager.id,
    created_at: daysAgo(3),
  });
  insertActivity.run({
    id: nanoid(),
    residence_id: residenceId,
    title: "Projection : soirée cinéma",
    description: "Film surprise, pop-corn offert.",
    category: "projection",
    activity_date: new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10),
    start_time: "20:30",
    end_time: null,
    location: "Salle commune",
    created_by: manager.id,
    created_at: daysAgo(3),
  });

  console.log("Base de données SQLite initialisée avec les données de démo.");
  console.log("Gestionnaire         : manager@residence-ops.fr / manager123");
  console.log("Résident (vérifié)   : etudiant@residence-ops.fr / resident123");
  console.log("Résident (en attente): sofia.rossi@residence-ops.fr / resident123");
}

// Exécuté seulement quand ce fichier est lancé directement (npm run seed / seed:prod),
// pas quand il est importé par le serveur pour un seed automatique au démarrage.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  db.close();
}
