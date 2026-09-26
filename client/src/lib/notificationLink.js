// Page vers laquelle une notification renvoie. Les notifications récentes portent leur lien (choisi par
// le serveur selon le destinataire) ; pour les anciennes, créées avant cette fonction, on le déduit du titre.
export function notificationLink(n, role) {
  if (n.link) return n.link;
  const t = (n.title || "").toLowerCase();
  const manager = role === "manager";
  if (t.includes("document")) return manager ? "/manager/documents" : "/administration?tab=documents";
  if (t.includes("rendez-vous")) return manager ? "/manager/rendez-vous" : "/administration?tab=rdv";
  if (t.includes("actualit")) return "/actualites";
  if (t.includes("activit")) return "/loisirs";
  if (t.includes("crédit") || t.includes("recharge")) return "/ma-carte";
  if (t.includes("bail")) return "/profil";
  if (t.includes("incident") || t.includes("intervention")) return "/";
  return null;
}
