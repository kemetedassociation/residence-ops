// Exécuté AVANT le démarrage du serveur (voir server/package.json, start:prod) — jamais après,
// car db.js ouvre une connexion better-sqlite3 dès son import : une fois cette connexion
// ouverte par un autre module, remplacer le fichier sous ses pieds ne la mettrait pas à jour.
//
// Sur le plan gratuit Render, le disque est effacé à chaque redéploiement. Sans ce script, le
// serveur repartirait chaque fois avec une base vide (puis se re-seed en données de
// démonstration). Ici, si une sauvegarde chiffrée existe sur le dépôt GitHub distant ET qu'aucun
// fichier local n'existe déjà, on la restaure avant que quoi que ce soit d'autre ne démarre.
import fs from "node:fs";
import { resolveDbPath } from "./dbPath.js";
import { decryptBuffer, isBackupEncryptionConfigured } from "../lib/backupCrypto.js";
import { downloadEncryptedBackup } from "../lib/githubBackupStore.js";

async function restore() {
  const dbPath = resolveDbPath();

  if (fs.existsSync(dbPath)) {
    console.log("Base de données locale déjà présente, pas de restauration nécessaire.");
    return;
  }

  if (!isBackupEncryptionConfigured()) {
    console.log("Pas de clé de chiffrement de sauvegarde configurée, restauration ignorée.");
    return;
  }

  // Plusieurs tentatives : une indisponibilité passagère de GitHub ne doit pas faire démarrer
  // le serveur avec une base vide (qui pourrait ensuite écraser la bonne sauvegarde).
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const encrypted = await downloadEncryptedBackup();
      if (!encrypted) {
        console.log("Aucune sauvegarde distante trouvée (première installation), démarrage avec une base vide.");
        return;
      }
      const plain = decryptBuffer(encrypted);
      fs.writeFileSync(dbPath, plain);
      console.log(`Base restaurée depuis la sauvegarde distante (${plain.length} octets).`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`Restauration : tentative ${attempt}/4 échouée (${err.message}).`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  console.error("Restauration impossible après 4 tentatives — arrêt pour ne pas démarrer sur une base vide :", lastError?.message);
  process.exit(1);
}

await restore();
