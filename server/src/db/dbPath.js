import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Partagé entre db.js (qui ouvre la connexion) et restore.js (qui doit vérifier/écrire le
// fichier avant que quoi que ce soit n'ouvre une connexion better-sqlite3 dessus) — les deux
// doivent absolument résoudre le même chemin.
export function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const dataDir = path.join(__dirname, "..", "..", "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "data.sqlite");
}
