import { toast } from "sonner";
import { api, getToken } from "./api";

export const MAX_FILE_MB = 10;
// Doit rester aligné sur la table FORMATS de server/src/routes/files.js.
export const DOCUMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv";
export const DOCUMENT_FORMATS_LABEL = "PDF, images, Word, Excel, PowerPoint, texte…";
const INLINE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

function filenameFrom(res) {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(res.headers.get("content-disposition") || "");
  return match ? decodeURIComponent(match[1]) : "document";
}

export async function uploadPrivateFile(file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Fichier trop volumineux (${MAX_FILE_MB} Mo maximum).`);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/files", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Échec de l'envoi du fichier.");
  return data.file;
}

// Les fichiers privés exigent le jeton de connexion : un simple lien <a href> ne peut pas
// l'envoyer. On récupère donc le fichier avec l'en-tête d'autorisation puis on l'ouvre via une
// URL locale. La fenêtre est ouverte tout de suite (pendant le geste de l'utilisateur) et
// renseignée ensuite : sinon Safari/iOS bloque l'ouverture après le téléchargement asynchrone.
export async function openPrivateFile(url) {
  const win = window.open("", "_blank");
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Impossible d'ouvrir le fichier.");
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    if (INLINE_TYPES.includes(blob.type)) {
      // PDF et images : affichés directement dans l'onglet.
      if (win) win.location.href = blobUrl;
      else window.location.href = blobUrl;
    } else {
      // Word, Excel, texte… : le navigateur ne sait pas les afficher, on les télécharge.
      win?.close();
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filenameFrom(res);
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
  } catch (err) {
    win?.close();
    toast.error(err.message);
  }
}
