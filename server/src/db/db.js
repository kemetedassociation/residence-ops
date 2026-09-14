import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Kept outside src/ on purpose: `node --watch-path=./src` would otherwise treat
// every WAL checkpoint write as a source change and restart the server in a loop.
const dataDir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const filePath = process.env.DB_PATH || path.join(dataDir, "data.sqlite");

export const db = new Database(filePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS residences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  total_buildings INTEGER DEFAULT 0,
  manager_email TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  residence_id TEXT NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floors INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('resident','manager','technicien')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT DEFAULT '',
  residence_id TEXT REFERENCES residences(id) ON DELETE SET NULL,
  building_id TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  room TEXT DEFAULT '',
  lease_number TEXT,
  lease_status TEXT NOT NULL DEFAULT 'none' CHECK (lease_status IN ('none','pending','verified','rejected')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  building_id TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  floor TEXT DEFAULT '',
  room TEXT DEFAULT '',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'signale',
  priority TEXT NOT NULL DEFAULT 'normal',
  confirmation_count INTEGER DEFAULT 1,
  is_validated INTEGER DEFAULT 0,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_date TEXT
);

CREATE TABLE IF NOT EXISTS incident_photos (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS confirmations (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(incident_id, user_id)
);

CREATE TABLE IF NOT EXISTS interventions (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  technician_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  technician_name TEXT DEFAULT '',
  technician_email TEXT DEFAULT '',
  scheduled_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planifiee',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'information',
  pinned INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1,
  cover_image_url TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'suggestion',
  title TEXT DEFAULT '',
  message TEXT NOT NULL,
  rating INTEGER,
  incident_id TEXT REFERENCES incidents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  target_building_id TEXT REFERENCES buildings(id) ON DELETE SET NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_building ON incidents(building_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

runMigrations(db);

export function withoutPassword(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

export function toBool(row, ...fields) {
  if (!row) return row;
  const copy = { ...row };
  fields.forEach((f) => {
    if (f in copy) copy[f] = !!copy[f];
  });
  return copy;
}
