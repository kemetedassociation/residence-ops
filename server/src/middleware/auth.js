import jwt from "jsonwebtoken";
import { db } from "../db/db.js";

// Modules que l'on peut accorder/retirer à un gestionnaire ou un technicien. Gardé ici (plutôt que
// dispersé) pour que le client et le serveur listent toujours exactement les mêmes clés.
export const STAFF_MODULES = [
  { key: "incidents", label: "Incidents et interventions" },
  { key: "actualites", label: "Actualités" },
  { key: "restaurant", label: "Restaurant" },
  { key: "documents", label: "Documents administratifs" },
  { key: "rendez_vous", label: "Rendez-vous (administration)" },
  { key: "loisirs", label: "Loisirs" },
  { key: "utilisateurs", label: "Résidents et baux" },
  { key: "accompagnement", label: "Accompagnement psychologique" },
  { key: "paiements", label: "Paiements" },
  { key: "erreurs", label: "Journal des erreurs" },
  { key: "parametres", label: "Paramètres de la résidence" },
  { key: "gestion_comptes", label: "Gestion des comptes administrateurs" },
];
const STAFF_MODULE_KEYS = STAFF_MODULES.map((m) => m.key);


export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Copy server/.env.example to server/.env and configure it.");
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié." });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    // Les jetons des professionnels de santé (accès séparé) ne donnent accès à AUCUNE route utilisateur.
    if (payload.kind === "care") return res.status(401).json({ error: "Session invalide, merci de vous reconnecter." });
    req.userId = payload.id;
    req.userRole = payload.role;
    // Un compte gestionnaire/technicien suspendu est coupé immédiatement, même avec un jeton encore
    // valide (sans attendre son expiration à 7 jours).
    if (payload.role === "manager" || payload.role === "technicien") {
      const row = db.prepare("SELECT is_suspended FROM users WHERE id = ?").get(payload.id);
      if (!row || row.is_suspended) return res.status(401).json({ error: "Ce compte a été suspendu. Contactez l'administrateur principal." });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Session invalide, merci de vous reconnecter." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    next();
  };
}

export function parsePermissions(raw) {
  if (raw == null) return null; // accès complet
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((k) => STAFF_MODULE_KEYS.includes(k)) : [];
  } catch {
    return [];
  }
}

// null = administrateur principal (accès complet) ; sinon, le module doit figurer dans la liste.
export function hasPermission(permissions, moduleKey) {
  return permissions === null || permissions.includes(moduleKey);
}

// Remplace requireRole("manager"[, "technicien"]) pour les pages d'administration : vérifie en plus
// que le compte n'est pas suspendu et qu'il a la permission du module demandé. La vérification se
// fait sur une lecture fraîche en base (pas sur le jeton) : retirer une permission ou suspendre un
// compte prend effet IMMÉDIATEMENT, sans attendre l'expiration du jeton (7 jours).
export function requireStaffPermission(moduleKey, { roles = ["manager", "technicien"] } = {}) {
  if (!STAFF_MODULE_KEYS.includes(moduleKey)) throw new Error(`Module de permission inconnu : ${moduleKey}`);
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) return res.status(403).json({ error: "Accès refusé." });
    const row = db.prepare("SELECT permissions, is_suspended FROM users WHERE id = ?").get(req.userId);
    if (!row || row.is_suspended) return res.status(403).json({ error: "Ce compte administrateur a été suspendu." });
    const permissions = parsePermissions(row.permissions);
    if (!hasPermission(permissions, moduleKey)) {
      return res.status(403).json({ error: "Vous n'avez pas accès à cette fonctionnalité." });
    }
    req.staffPermissions = permissions;
    next();
  };
}

export function requireLease(req, res, next) {
  const user = db.prepare("SELECT lease_status FROM users WHERE id = ?").get(req.userId);
  if (user?.lease_status !== "verified") {
    return res.status(403).json({
      error: "Un numéro de bail vérifié par un gestionnaire est requis pour effectuer cette action.",
      code: "LEASE_REQUIRED",
    });
  }
  next();
}

// Accès des professionnels de santé (psychologues) : jeton distinct de celui des utilisateurs.
export function signCareToken(professional) {
  return jwt.sign({ kind: "care", care_pro_id: professional.id }, JWT_SECRET, { expiresIn: "12h" });
}

export function requireCarePro(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Non authentifié." });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.kind !== "care") return res.status(403).json({ error: "Accès refusé." });
    const pro = db.prepare("SELECT * FROM care_professionals WHERE id = ? AND active = 1").get(payload.care_pro_id);
    if (!pro) return res.status(401).json({ error: "Session invalide." });
    req.pro = pro;
    next();
  } catch {
    return res.status(401).json({ error: "Session invalide, merci de vous reconnecter." });
  }
}
