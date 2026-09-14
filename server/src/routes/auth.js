import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";
import { db, withoutPassword } from "../db/db.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../schemas.js";
import { sendMail } from "../lib/mailer.js";

export const authRouter = Router();

// Bump this whenever the privacy policy content materially changes — consent recorded
// at registration is tied to this version so we can prove which text a user agreed to.
const PRIVACY_POLICY_VERSION = "2026-09-v1";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The automated test suite legitimately exercises far more than 20 auth calls
  // (many describe blocks each register their own users) within a single process.
  limit: process.env.VITEST ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives, merci de réessayer dans quelques minutes." },
});

authRouter.post("/register", authLimiter, validate(registerSchema), (req, res) => {
  const { name, email, password, phone, residence_id, building_id, room, lease_number } = req.body;

  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email);
  if (existing) {
    return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
  }

  const residence = residence_id || db.prepare("SELECT id FROM residences LIMIT 1").get()?.id;
  const now = new Date().toISOString();
  const user = {
    id: nanoid(),
    role: "resident",
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    phone,
    residence_id: residence || null,
    building_id: building_id || null,
    room,
    lease_number: lease_number || null,
    lease_status: lease_number ? "pending" : "none",
    created_at: now,
  };

  db.prepare(
    `INSERT INTO users (id, role, name, email, password, phone, residence_id, building_id, room, lease_number, lease_status, created_at)
     VALUES (@id, @role, @name, @email, @password, @phone, @residence_id, @building_id, @room, @lease_number, @lease_status, @created_at)`
  ).run(user);

  db.prepare("INSERT INTO consents (id, user_id, type, version, accepted_at) VALUES (?, ?, 'privacy_policy', ?, ?)").run(
    nanoid(),
    user.id,
    PRIVACY_POLICY_VERSION,
    now
  );

  const token = signToken(user);
  res.status(201).json({ token, user: withoutPassword(user) });
});

authRouter.post("/login", authLimiter, validate(loginSchema), (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Identifiants incorrects." });
  }

  const token = signToken(user);
  res.json({ token, user: withoutPassword(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
  res.json({ user: withoutPassword(user) });
});

authRouter.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);

  // Always respond the same way whether the account exists or not, to avoid leaking which emails are registered.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare(
      "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)"
    ).run(nanoid(), user.id, tokenHash, expiresAt, new Date().toISOString());

    const resetLink = `${req.headers.origin || "http://localhost:5173"}/reinitialiser-mot-de-passe?token=${rawToken}`;
    try {
      await sendMail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe — Résidence Ops",
        html: `<p>Bonjour ${user.name},</p><p>Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1h) :</p><p><a href="${resetLink}">${resetLink}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
        text: `Réinitialisez votre mot de passe : ${resetLink}`,
      });
    } catch (err) {
      console.error("Erreur d'envoi d'email :", err.message);
    }
  }

  res.json({ ok: true, message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
});

authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), (req, res) => {
  const { token, password } = req.body;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const reset = db
    .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?")
    .get(tokenHash, new Date().toISOString());

  if (!reset) {
    return res.status(400).json({ error: "Lien invalide ou expiré." });
  }

  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), reset.user_id);
  db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id);

  res.json({ ok: true });
});
