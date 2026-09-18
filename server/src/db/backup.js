import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { encryptBuffer, isBackupEncryptionConfigured } from "../lib/backupCrypto.js";
import { uploadEncryptedBackup } from "../lib/githubBackupStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// BACKUPS_DIR permet de pointer vers le disque persistant en production (voir render.yaml) —
// sinon les sauvegardes elles-mêmes disparaîtraient à chaque redéploiement.
const backupsDir = process.env.BACKUPS_DIR || path.join(__dirname, "..", "..", "backups");

export async function backupNow(retention = 14) {
  fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupsDir, `residence-ops-${timestamp}.sqlite`);

  await db.backup(target);
  console.log(`Sauvegarde créée : ${target}`);

  const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".sqlite")).sort();
  const toDelete = backups.slice(0, Math.max(0, backups.length - retention));
  toDelete.forEach((f) => fs.unlinkSync(path.join(backupsDir, f)));
  if (toDelete.length) console.log(`${toDelete.length} ancienne(s) sauvegarde(s) supprimée(s) (rétention ${retention}).`);

  // Envoi hors-site (dépôt GitHub privé dédié, jamais le dépôt de code) pour survivre à un
  // redéploiement sur le plan gratuit Render, qui efface le disque local à chaque fois.
  // Chiffré avant l'envoi : même si le dépôt ou le token fuitaient, le contenu resterait
  // illisible sans BACKUP_ENCRYPTION_KEY (qui, elle, ne quitte jamais Render).
  if (isBackupEncryptionConfigured()) {
    try {
      const plain = fs.readFileSync(target);
      const uploaded = await uploadEncryptedBackup(encryptBuffer(plain));
      if (uploaded) console.log("Sauvegarde chiffrée envoyée vers le dépôt GitHub distant.");
    } catch (err) {
      console.error("Échec de l'envoi de la sauvegarde distante (la sauvegarde locale reste valide) :", err.message);
    }
  }

  return target;
}

// Exécuté seulement quand ce fichier est lancé directement (npm run backup),
// pas quand il est importé pour la sauvegarde périodique automatique du serveur.
if (import.meta.url === `file://${process.argv[1]}`) {
  await backupNow();
  db.close();
}
