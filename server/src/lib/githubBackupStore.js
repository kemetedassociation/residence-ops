// Stocke/récupère la sauvegarde chiffrée de la base sur un dépôt GitHub privé DÉDIÉ (jamais
// le dépôt de code source, qui peut être public). GITHUB_BACKUP_TOKEN doit être un token à
// portée fine limité à ce seul dépôt (permission Contents: Read and write).

const BACKUP_PATH = "latest.sqlite.enc";

// Limite connue : l'API "Contents" de GitHub refuse les fichiers de plus de ~1 Mo par cette
// voie (JSON+base64). Largement suffisant pour une petite résidence au démarrage ; si la base
// grossit significativement, il faudra passer par l'API Git Data (blobs) à la place.

function isConfigured() {
  return !!(process.env.GITHUB_BACKUP_TOKEN && process.env.GITHUB_BACKUP_REPO);
}

function apiUrl() {
  return `https://api.github.com/repos/${process.env.GITHUB_BACKUP_REPO}/contents/${BACKUP_PATH}`;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_BACKUP_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function uploadEncryptedBackup(encryptedBuffer) {
  if (!isConfigured()) return false;

  // Une mise à jour de fichier exige le sha de la version actuelle (sinon GitHub refuse) —
  // on le récupère d'abord ; 404 = premier envoi, pas d'erreur.
  let sha;
  const existing = await fetch(apiUrl(), { headers: headers() });
  if (existing.ok) {
    sha = (await existing.json()).sha;
  } else if (existing.status !== 404) {
    throw new Error(`Lecture de la sauvegarde distante échouée (HTTP ${existing.status}).`);
  }

  const res = await fetch(apiUrl(), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message: `Sauvegarde automatique — ${new Date().toISOString()}`,
      content: encryptedBuffer.toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Envoi de la sauvegarde distante échoué (HTTP ${res.status}).`);
  }
  return true;
}

export async function downloadEncryptedBackup() {
  if (!isConfigured()) return null;

  const res = await fetch(apiUrl(), { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Téléchargement de la sauvegarde distante échoué (HTTP ${res.status}).`);
  }
  const { content } = await res.json();
  return Buffer.from(content, "base64");
}
