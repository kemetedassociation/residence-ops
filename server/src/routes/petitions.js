import { Router } from "express";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/db.js";
import { validate } from "../middleware/validate.js";

export const petitionsRouter = Router();

// Seules les pétitions listées ici acceptent des signatures (évite de remplir la base avec
// n'importe quel identifiant inventé).
const KNOWN_PETITIONS = new Set(["oiseaux"]);

const signSchema = z.object({
  nom: z.string().trim().min(1).max(80),
  prenom: z.string().trim().min(1).max(80),
  logement: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(180).optional().or(z.literal("")).default(""),
  consentement: z.literal(true),
});

const signLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.VITEST ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives depuis cette connexion. Réessayez plus tard." },
});

const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

petitionsRouter.post("/:slug/sign", signLimiter, validate(signSchema), (req, res) => {
  if (!KNOWN_PETITIONS.has(req.params.slug)) return res.status(404).json({ error: "Pétition introuvable." });

  const { nom, prenom, logement, email } = req.body;
  // Même personne = même nom, prénom et logement (accents/casse/espaces ignorés) : évite les
  // doublons involontaires sans exiger de compte.
  const identityKey = crypto.createHash("sha256").update([nom, prenom, logement].map(normalize).join("|")).digest("hex");

  try {
    db.prepare(
      "INSERT INTO petition_signatures (id, petition, nom, prenom, logement, email, identity_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(nanoid(), req.params.slug, nom, prenom, logement, email || null, identityKey, new Date().toISOString());
  } catch (err) {
    if (String(err.code).startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({ error: "Cette signature existe déjà. Merci de ne signer qu'une seule fois." });
    }
    throw err;
  }
  res.status(201).json({ ok: true });
});

// Lecture réservée à PETITION_ADMIN_TOKEN (variable d'environnement, jamais dans le code).
// Sans cette variable, l'export est désactivé — pas d'accès par défaut.
function requireAdminToken(req, res, next) {
  const expected = process.env.PETITION_ADMIN_TOKEN;
  const given = req.headers["x-admin-token"];
  if (!expected || expected.length < 16 || typeof given !== "string") {
    return res.status(403).json({ error: "Accès refusé." });
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: "Accès refusé." });
  next();
}

petitionsRouter.get("/:slug/signatures", requireAdminToken, (req, res) => {
  const rows = db
    .prepare("SELECT nom, prenom, logement, email, created_at FROM petition_signatures WHERE petition = ? ORDER BY created_at")
    .all(req.params.slug);
  res.json({ count: rows.length, signatures: rows });
});
