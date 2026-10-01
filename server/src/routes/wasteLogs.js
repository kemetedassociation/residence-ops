import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireStaffPermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { wasteLogCreateSchema } from "../schemas.js";
import { residenceIdForUser } from "../lib/residence.js";
import { findMenuItem } from "../lib/menuItems.js";

export const wasteLogsRouter = Router();
wasteLogsRouter.use(requireAuth);

wasteLogsRouter.get("/stats", requireStaffPermission("restaurant"), (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const row = db
    .prepare("SELECT COALESCE(SUM(saved),0) as total_saved, COALESCE(SUM(lost),0) as total_lost FROM waste_logs WHERE residence_id = ?")
    .get(residenceId);
  const total = row.total_saved + row.total_lost;
  res.json({ total_saved: row.total_saved, total_lost: row.total_lost, rate: total > 0 ? row.total_saved / total : null });
});

wasteLogsRouter.get("/", requireStaffPermission("restaurant"), (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const { menu_id } = req.query;
  const waste_logs = menu_id
    ? db.prepare("SELECT * FROM waste_logs WHERE residence_id = ? AND menu_id = ? ORDER BY created_at DESC").all(residenceId, menu_id)
    : db.prepare("SELECT * FROM waste_logs WHERE residence_id = ? ORDER BY created_at DESC").all(residenceId);
  res.json({ waste_logs });
});

wasteLogsRouter.post("/", requireStaffPermission("restaurant"), validate(wasteLogCreateSchema), (req, res) => {
  const { menu_id, dish, saved } = req.body;
  const residenceId = residenceIdForUser(req.userId);

  const menu = db.prepare("SELECT * FROM menus WHERE id = ? AND residence_id = ?").get(menu_id, residenceId);
  if (!menu) return res.status(404).json({ error: "Menu introuvable." });

  const menuItem = findMenuItem(menu.items, dish);
  if (!menuItem) return res.status(400).json({ error: "Ce plat ne fait pas partie du menu." });
  if (menuItem.max_portions == null) {
    return res.status(400).json({ error: "Ce plat n'a pas de quantité préparée définie : impossible de calculer les pertes." });
  }

  const { reserved } = db
    .prepare("SELECT COUNT(*) as reserved FROM meal_reservations WHERE menu_id = ? AND dish = ? AND status = 'reservee'")
    .get(menu_id, dish);
  const prepared = menuItem.max_portions;
  const remaining = Math.max(0, prepared - reserved);

  if (saved > remaining) {
    return res.status(400).json({ error: `Le nombre sauvé (${saved}) dépasse les portions restantes (${remaining}).` });
  }

  const lost = remaining - saved;
  const existing = db.prepare("SELECT id FROM waste_logs WHERE menu_id = ? AND dish = ?").get(menu_id, dish);
  const row = {
    id: existing?.id || nanoid(),
    residence_id: residenceId,
    menu_id,
    menu_date: menu.menu_date,
    meal: menu.meal,
    dish,
    prepared,
    reserved,
    remaining,
    saved,
    lost,
    created_by: req.userId,
    created_at: new Date().toISOString(),
  };

  if (existing) {
    db.prepare(
      `UPDATE waste_logs SET prepared=@prepared, reserved=@reserved, remaining=@remaining, saved=@saved, lost=@lost,
       created_by=@created_by, created_at=@created_at WHERE id=@id`
    ).run(row);
  } else {
    db.prepare(
      `INSERT INTO waste_logs (id, residence_id, menu_id, menu_date, meal, dish, prepared, reserved, remaining, saved, lost, created_by, created_at)
       VALUES (@id, @residence_id, @menu_id, @menu_date, @meal, @dish, @prepared, @reserved, @remaining, @saved, @lost, @created_by, @created_at)`
    ).run(row);
  }

  res.status(201).json({ waste_log: row });
});
