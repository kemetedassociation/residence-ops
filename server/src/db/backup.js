import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupsDir = path.join(__dirname, "..", "..", "backups");
fs.mkdirSync(backupsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupsDir, `residence-ops-${timestamp}.sqlite`);

await db.backup(target);
console.log(`Sauvegarde créée : ${target}`);

const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".sqlite")).sort();
const toDelete = backups.slice(0, Math.max(0, backups.length - 14));
toDelete.forEach((f) => fs.unlinkSync(path.join(backupsDir, f)));
if (toDelete.length) console.log(`${toDelete.length} ancienne(s) sauvegarde(s) supprimée(s) (rétention 14).`);

process.exit(0);
