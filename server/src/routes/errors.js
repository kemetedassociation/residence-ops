import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/db.js";
import { requireAuth, requireRole, JWT_SECRET } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const errorsRouter = Router();

const reportSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  url: z.string().max(500).optional().nullable(),
});

// Volontairement sans authentification requise : une erreur peut survenir avant même la
// connexion (ex. écran de login cassé). Limité pour éviter qu'un client buggé ne spamme la
// table en boucle.
const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: process.env.VITEST ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
});

errorsRouter.post("/", reportLimiter, validate(reportSchema), (req, res) => {
  let userId = null;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      userId = jwt.verify(header.slice(7), JWT_SECRET).id;
    } catch {
      // token absent/invalide : on garde le rapport quand même, juste sans utilisateur associé
    }
  }

  const { message, stack, url } = req.body;
  console.error("Erreur client signalée :", message, url ? `(${url})` : "");

  db.prepare(
    "INSERT INTO client_errors (id, message, stack, url, user_agent, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(nanoid(), message, stack || null, url || null, req.headers["user-agent"] || null, userId, new Date().toISOString());

  res.status(201).json({ ok: true });
});

// Accès gestionnaire uniquement : une vue minimale des erreurs récentes, en attendant un
// vrai outil de suivi (Sentry ou équivalent) si le volume le justifie un jour.
errorsRouter.get("/", requireAuth, requireRole("manager"), (req, res) => {
  const errors = db.prepare("SELECT * FROM client_errors ORDER BY created_at DESC LIMIT 50").all();
  res.json({ errors });
});
