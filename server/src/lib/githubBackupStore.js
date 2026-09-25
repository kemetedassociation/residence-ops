// Stocke/récupère la sauvegarde chiffrée de la base sur un dépôt GitHub privé DÉDIÉ (jamais
// le dépôt de code source, qui peut être public). GITHUB_BACKUP_TOKEN doit être un token à
// portée fine limité à ce seul dépôt (permission Contents: Read and write).

const BACKUP_PATH = "latest.sqlite.enc";

// Limite connue : l'API "Contents" de GitHub refuse les fichiers de plus de ~1 Mo par cette
// voie (JSON+base64). Largement suffisant pour une petite résidence au démarrage ; si la base
// grossit significativement, il faudra passer par l'API Git Data (blobs) à la place.

// Un token copié-collé dans un tableau de bord contient souvent un retour à la ligne, une espace ou
// un caractère invisible en trop, voire des guillemets : fetch refuse alors l'en-tête entier. Un
// token GitHub ne contient que des caractères ASCII imprimables sans espace : on ne garde que ceux-là.
export function cleanToken(raw) {
  return String(raw || "")
    .replace(/[^\x21-\x7e]/g, "")
    .replace(/^["']+|["']+$/g, "");
}

function cleanRepo(raw) {
  return String(raw || "").replace(/[^\x21-\x7e]/g, "").replace(/^["']+|["']+$/g, "").replace(/^\/+|\/+$/g, "");
}

function isConfigured() {
  return !!(cleanToken(process.env.GITHUB_BACKUP_TOKEN) && cleanRepo(process.env.GITHUB_BACKUP_REPO));
}

function apiUrl() {
  return `https://api.github.com/repos/${cleanRepo(process.env.GITHUB_BACKUP_REPO)}/contents/${BACKUP_PATH}`;
}

// Le message d'erreur natif de fetch peut CONTENIR la valeur de l'en-tête, donc le token en clair :
// on ne le laisse jamais atteindre les journaux.
async function github(url, init) {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof TypeError && /header/i.test(err.message)) {
      throw Object.assign(new Error("Le jeton GitHub de sauvegarde contient des caractères invalides."), { configError: true });
    }
    throw new Error(`Réseau indisponible (${err.cause?.code || "erreur inconnue"}).`);
  }
}

function httpError(action, status) {
  const err = new Error(`${action} (HTTP ${status}).`);
  err.status = status;
  return err;
}

function headers() {
  return {
    Authorization: `Bearer ${cleanToken(process.env.GITHUB_BACKUP_TOKEN)}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function uploadEncryptedBackup(encryptedBuffer) {
  if (!isConfigured()) return false;

  // Une mise à jour de fichier exige le sha de la version actuelle (sinon GitHub refuse) —
  // on le récupère d'abord ; 404 = premier envoi, pas d'erreur.
  let sha;
  const existing = await github(apiUrl(), { headers: headers() });
  if (existing.ok) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    throw httpError("Lecture de la sauvegarde distante échouée", existing.status);
  }

  const res = await github(apiUrl(), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message: `Sauvegarde automatique — ${new Date().toISOString()}`,
      content: encryptedBuffer.toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw httpError("Envoi de la sauvegarde distante échoué", res.status);
  }
  return true;
}

export async function downloadEncryptedBackup() {
  if (!isConfigured()) return null;

  const res = await github(apiUrl(), { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw httpError("Téléchargement de la sauvegarde distante échoué", res.status);
  }
  const { content } = await res.json();
  return Buffer.from(content, "base64");
}
