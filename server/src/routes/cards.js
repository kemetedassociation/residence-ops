import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { walletCreditSchema } from "../schemas.js";
import { getOrCreateCard, applyWalletTransaction } from "../lib/wallet.js";
import { notifyUsers } from "./notifications.js";

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

function withHistory(card) {
  const transactions = db
    .prepare("SELECT * FROM wallet_transactions WHERE card_id = ? ORDER BY created_at DESC")
    .all(card.id);
  return { card, transactions };
}

cardsRouter.get("/me", requireRole("resident"), (req, res) => {
  const card = getOrCreateCard(req.userId);
  res.json(withHistory(card));
});

cardsRouter.get("/:userId", requireRole("manager"), (req, res) => {
  const user = db.prepare("SELECT id, name, room, building_id FROM users WHERE id = ?").get(req.params.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const card = getOrCreateCard(req.params.userId);
  res.json({ user, ...withHistory(card) });
});

cardsRouter.post("/:userId/credit", requireRole("manager"), validate(walletCreditSchema), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.userId);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

  const card = getOrCreateCard(req.params.userId);
  try {
    const updated = applyWalletTransaction(card.id, req.body.amount_cents, "credit", req.body.reason, req.userId);

    notifyUsers([user.id], {
      title: "Crédit ajouté à votre carte",
      message: `${(req.body.amount_cents / 100).toFixed(2)} € ont été ajoutés à votre solde (${req.body.reason}).`,
      type: "info",
      link: "/ma-carte",
    });

    res.json(withHistory(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
