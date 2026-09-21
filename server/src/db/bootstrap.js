import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "./db.js";

// Amorçage d'une vraie résidence (SEED_MODE=production) : crée UNIQUEMENT la résidence et son
// premier gestionnaire, à partir de variables d'environnement — aucun compte de démonstration
// aux identifiants publics (manager123...) ne doit exister sur une installation réelle.
export function bootstrapProduction() {
  const name = process.env.INITIAL_RESIDENCE_NAME;
  const email = process.env.INITIAL_MANAGER_EMAIL;
  const password = process.env.INITIAL_MANAGER_PASSWORD;
  if (!name || !email || !password) {
    throw new Error("SEED_MODE=production exige INITIAL_RESIDENCE_NAME, INITIAL_MANAGER_EMAIL et INITIAL_MANAGER_PASSWORD.");
  }
  if (password.length < 12) {
    throw new Error("INITIAL_MANAGER_PASSWORD doit contenir au moins 12 caractères.");
  }

  const now = new Date().toISOString();
  const residenceId = nanoid();
  db.prepare(
    `INSERT INTO residences (id, name, address, city, latitude, longitude, total_buildings, manager_email, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    residenceId,
    name,
    process.env.INITIAL_RESIDENCE_ADDRESS || "",
    process.env.INITIAL_RESIDENCE_CITY || "",
    Number(process.env.INITIAL_RESIDENCE_LAT) || 48.8566,
    Number(process.env.INITIAL_RESIDENCE_LNG) || 2.3522,
    email,
    now
  );
  db.prepare(
    `INSERT INTO users (id, role, name, email, password, phone, residence_id, building_id, room, lease_number, lease_status, created_at)
     VALUES (?, 'manager', ?, ?, ?, '', ?, NULL, '', NULL, 'none', ?)`
  ).run(nanoid(), process.env.INITIAL_MANAGER_NAME || "Gestionnaire", email, bcrypt.hashSync(password, 10), residenceId, now);

  console.log(`Résidence « ${name} » et gestionnaire ${email} créés (mode production, sans données de démo).`);
}
