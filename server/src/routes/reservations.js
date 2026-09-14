import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { reservationCreateSchema } from "../schemas.js";
import { getOrCreateCard, applyWalletTransaction } from "../lib/wallet.js";

export const reservationsRouter = Router();
reservationsRouter.use(requireAuth);

const MEAL_PRICE_CENTS = 350;

reservationsRouter.get("/", (req, res) => {
  if (req.userRole === "resident") {
    const reservations = db
      .prepare("SELECT * FROM meal_reservations WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.userId);
    return res.json({ reservations });
  }

  const { menu_id } = req.query;
  if (menu_id) {
    const aggregate = db
      .prepare(
        "SELECT dish, COUNT(*) as count FROM meal_reservations WHERE menu_id = ? AND status = 'reservee' GROUP BY dish"
      )
      .all(menu_id);
    return res.json({ aggregate });
  }

  const reservations = db.prepare("SELECT * FROM meal_reservations ORDER BY created_at DESC").all();
  res.json({ reservations });
});

reservationsRouter.post("/", requireRole("resident"), requireLease, validate(reservationCreateSchema), (req, res) => {
  const { menu_id, dish, pay_with_card } = req.body;
  const menu = db.prepare("SELECT * FROM menus WHERE id = ?").get(menu_id);
  if (!menu) return res.status(404).json({ error: "Menu introuvable." });

  const items = JSON.parse(menu.items);
  if (!items.includes(dish)) return res.status(400).json({ error: "Ce plat ne fait pas partie du menu." });

  const existing = db.prepare("SELECT * FROM meal_reservations WHERE menu_id = ? AND user_id = ?").get(menu_id, req.userId);
  if (existing && existing.status === "reservee") {
    return res.status(409).json({ error: "Vous avez déjà une réservation pour ce repas." });
  }

  if (pay_with_card) {
    const card = getOrCreateCard(req.userId);
    try {
      applyWalletTransaction(card.id, MEAL_PRICE_CENTS, "debit", `Réservation repas — ${dish}`, req.userId);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  const reservation = {
    id: existing?.id || nanoid(),
    menu_id,
    user_id: req.userId,
    dish,
    status: "reservee",
    paid_with_card: pay_with_card ? 1 : 0,
    created_at: new Date().toISOString(),
  };

  if (existing) {
    db.prepare(
      "UPDATE meal_reservations SET dish=@dish, status=@status, paid_with_card=@paid_with_card, created_at=@created_at WHERE id=@id"
    ).run(reservation);
  } else {
    db.prepare(
      `INSERT INTO meal_reservations (id, menu_id, user_id, dish, status, paid_with_card, created_at)
       VALUES (@id, @menu_id, @user_id, @dish, @status, @paid_with_card, @created_at)`
    ).run(reservation);
  }

  res.status(201).json({ reservation });
});

reservationsRouter.patch("/:id/cancel", requireRole("resident"), (req, res) => {
  const reservation = db.prepare("SELECT * FROM meal_reservations WHERE id = ? AND user_id = ?").get(req.params.id, req.userId);
  if (!reservation) return res.status(404).json({ error: "Réservation introuvable." });
  if (reservation.status === "annulee") return res.json({ reservation });

  if (reservation.paid_with_card) {
    const card = getOrCreateCard(req.userId);
    applyWalletTransaction(card.id, MEAL_PRICE_CENTS, "credit", `Remboursement annulation — ${reservation.dish}`, req.userId);
  }

  db.prepare("UPDATE meal_reservations SET status = 'annulee' WHERE id = ?").run(req.params.id);
  res.json({ reservation: db.prepare("SELECT * FROM meal_reservations WHERE id = ?").get(req.params.id) });
});
