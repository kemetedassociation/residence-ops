// Voix naturelle d'Isis (Azure AI Speech), à la place de la voix mécanique du navigateur. La clé
// Azure ne doit JAMAIS atteindre le client : le serveur appelle Azure et renvoie l'audio généré.
let cachedToken = null;
let tokenExpiresAt = 0;

export function isAzureSpeechConfigured() {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const region = process.env.AZURE_SPEECH_REGION;
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY, "Content-Length": "0" },
  });
  if (!res.ok) throw new Error(`jeton Azure refusé (HTTP ${res.status})`);
  cachedToken = await res.text();
  tokenExpiresAt = Date.now() + 9 * 60 * 1000; // jetons valables 10 min : marge de sécurité
  return cachedToken;
}

const escapeSsml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function synthesizeSpeech(text) {
  const region = process.env.AZURE_SPEECH_REGION;
  const voice = process.env.AZURE_SPEECH_VOICE || "fr-FR-DeniseNeural";
  const token = await getAccessToken();
  const ssml = `<speak version="1.0" xml:lang="fr-FR"><voice name="${voice}"><prosody rate="1.0">${escapeSsml(text)}</prosody></voice></speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "ResidenceOps-Isis",
    },
    body: ssml,
  });
  if (!res.ok) {
    cachedToken = null; // le jeton a pu expirer ou être invalide : on en redemandera un au prochain essai
    const detail = await res.text().catch(() => "");
    throw new Error(`synthèse Azure refusée (HTTP ${res.status})${detail ? " — " + detail.slice(0, 200) : ""}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
