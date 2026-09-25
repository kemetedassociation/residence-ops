import jwt from "jsonwebtoken";
import { db } from "../db/db.js";

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
