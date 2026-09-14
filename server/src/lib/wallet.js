import crypto from "node:crypto";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";

export function getOrCreateCard(userId) {
  let card = db.prepare("SELECT * FROM resident_cards WHERE user_id = ?").get(userId);
  if (card) return card;

  card = {
    id: nanoid(),
    user_id: userId,
    qr_token: crypto.randomBytes(16).toString("hex"),
    balance_cents: 0,
    status: "active",
    created_at: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO resident_cards (id, user_id, qr_token, balance_cents, status, created_at) VALUES (@id, @user_id, @qr_token, @balance_cents, @status, @created_at)"
  ).run(card);
  return card;
}

// Applies a credit/debit atomically and returns the updated card. Throws if a debit
// would take the balance below zero.
export const applyWalletTransaction = db.transaction((cardId, amountCents, type, reason, createdBy) => {
  const card = db.prepare("SELECT * FROM resident_cards WHERE id = ?").get(cardId);
  if (!card) throw new Error("Carte introuvable.");

  const signedAmount = type === "debit" ? -Math.abs(amountCents) : Math.abs(amountCents);
  const newBalance = card.balance_cents + signedAmount;
  if (newBalance < 0) throw new Error("Solde insuffisant.");

  db.prepare("UPDATE resident_cards SET balance_cents = ? WHERE id = ?").run(newBalance, cardId);
  db.prepare(
    "INSERT INTO wallet_transactions (id, card_id, amount_cents, type, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(nanoid(), cardId, signedAmount, type, reason, createdBy || null, new Date().toISOString());

  return db.prepare("SELECT * FROM resident_cards WHERE id = ?").get(cardId);
});
