import crypto from "node:crypto";

// Chiffre les secrets stockés en base (clés API des prestataires de paiement). Clé : PAYMENTS_SECRET_KEY
// (64 caractères hexadécimaux) si définie, sinon dérivée de JWT_SECRET — stable d'un déploiement à
// l'autre sur Render. Si cette clé change, les secrets enregistrés deviennent illisibles et
// l'administrateur doit simplement les ressaisir.
function key() {
  const hex = process.env.PAYMENTS_SECRET_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex");
  return crypto.createHash("sha256").update(`payments-secrets:${process.env.JWT_SECRET}`).digest();
}

export function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptText(payload) {
  const buf = Buffer.from(payload, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
