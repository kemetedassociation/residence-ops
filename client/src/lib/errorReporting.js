import { getToken } from "./api";

// Envoie une erreur au serveur pour qu'elle soit visible en production (voir
// server/src/routes/errors.js et l'onglet "Erreurs" côté gestionnaire) — au mieux, sans
// jamais faire échouer quoi que ce soit si l'envoi lui-même rate (hors-ligne, etc.).
export function reportError(error) {
  try {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch("/api/client-errors", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: String(error?.message || error || "Erreur inconnue").slice(0, 2000),
        stack: error?.stack ? String(error.stack).slice(0, 8000) : null,
        url: window.location.href,
      }),
    }).catch(() => {});
  } catch {
    // ne jamais faire échouer l'appelant à cause du rapport d'erreur lui-même
  }
}

export function installGlobalErrorReporting() {
  window.addEventListener("error", (event) => reportError(event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason));
}
