import { Router } from "express";
import { db, withoutPassword } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { userPatchMeSchema, leaseReviewSchema } from "../schemas.js";
import { notifyUsers } from "./notifications.js";
import { getOrCreateCard } from "../lib/wallet.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/", requireRole("manager"), (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY name").all().map(withoutPassword);
  res.json({ users });
});

usersRouter.patch("/me", validate(userPatchMeSchema), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const body = req.body;
  const leaseChanged = body.lease_number !== undefined && body.lease_number !== user.lease_number;

  const updated = {
    ...user,
    ...body,
    lease_status: leaseChanged ? (body.lease_number ? "pending" : "none") : user.lease_status,
  };

  db.prepare(
    "UPDATE users SET name=@name, phone=@phone, room=@room, building_id=@building_id, lease_number=@lease_number, lease_status=@lease_status WHERE id=@id"
  ).run(updated);

  res.json({ user: withoutPassword(db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId)) });
});

usersRouter.patch("/:id/lease", requireRole("manager"), validate(leaseReviewSchema), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  db.prepare("UPDATE users SET lease_status = ? WHERE id = ?").run(req.body.lease_status, req.params.id);

  // A verified lease unlocks the digital resident card + wallet.
  if (req.body.lease_status === "verified") {
    getOrCreateCard(user.id);
  }

  const messages = {
    verified: "Votre numéro de bail a été vérifié. Vous avez maintenant accès à toutes les fonctionnalités.",
    rejected: "Votre numéro de bail n'a pas pu être vérifié. Merci de le corriger dans votre profil.",
    none: "Le statut de votre bail a été réinitialisé.",
  };
  notifyUsers([user.id], { title: "Statut du bail mis à jour", message: messages[req.body.lease_status], type: "info" });

  res.json({ user: withoutPassword(db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id)) });
});
