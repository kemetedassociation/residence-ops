import crypto from "node:crypto";

// BACKUP_ENCRYPTION_KEY : 32 octets en hexadécimal (64 caractères), générés une fois et gardés
// secrets côté Render uniquement — jamais dans le dépôt. Sans cette clé, un fichier de
// sauvegarde intercepté (dépôt GitHub compromis, token volé...) est illisible : chaque
// sauvegarde de données de résidents part chiffrée, jamais en clair, vers un service tiers.
function getKey() {
  const hex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("BACKUP_ENCRYPTION_KEY manquante ou invalide (attendu : 64 caractères hexadécimaux).");
  }
  return Buffer.from(hex, "hex");
}

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

export function encryptBuffer(plainBuffer) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // [iv (12)][authTag (16)][ciphertext...] — tout ce qu'il faut pour déchiffrer, sans jamais
  // inclure la clé elle-même dans ce qui est envoyé au dépôt.
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(blob) {
  const key = getKey();
  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = blob.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isBackupEncryptionConfigured() {
  return !!process.env.BACKUP_ENCRYPTION_KEY && process.env.BACKUP_ENCRYPTION_KEY.length === 64;
}
