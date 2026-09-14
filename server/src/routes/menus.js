import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { menuCreateSchema, menuPatchSchema } from "../schemas.js";
import { residenceIdForUser } from "../lib/residence.js";

export const menusRouter = Router();
menusRouter.use(requireAuth);

function withItems(menu) {
  return menu && { ...menu, items: JSON.parse(menu.items) };
}

menusRouter.get("/", (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const menus = db
    .prepare("SELECT * FROM menus WHERE residence_id = ? ORDER BY menu_date ASC, meal ASC")
    .all(residenceId);
  res.json({ menus: menus.map(withItems) });
});

menusRouter.post("/", requireRole("manager"), validate(menuCreateSchema), (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const menu = {
    id: nanoid(),
    residence_id: residenceId,
    menu_date: req.body.menu_date,
    meal: req.body.meal,
    items: JSON.stringify(req.body.items),
    created_by: req.userId,
    created_at: new Date().toISOString(),
  };

  try {
    db.prepare(
      `INSERT INTO menus (id, residence_id, menu_date, meal, items, created_by, created_at)
       VALUES (@id, @residence_id, @menu_date, @meal, @items, @created_by, @created_at)`
    ).run(menu);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Un menu existe déjà pour cette date et ce repas." });
    }
    throw err;
  }

  res.status(201).json({ menu: withItems(menu) });
});

menusRouter.put("/:id", requireRole("manager"), validate(menuPatchSchema), (req, res) => {
  const menu = db.prepare("SELECT * FROM menus WHERE id = ?").get(req.params.id);
  if (!menu) return res.status(404).json({ error: "Menu introuvable." });

  const updated = {
    ...menu,
    ...req.body,
    items: req.body.items ? JSON.stringify(req.body.items) : menu.items,
  };
  db.prepare("UPDATE menus SET menu_date=@menu_date, meal=@meal, items=@items WHERE id=@id").run(updated);

  res.json({ menu: withItems(db.prepare("SELECT * FROM menus WHERE id = ?").get(req.params.id)) });
});

menusRouter.delete("/:id", requireRole("manager"), (req, res) => {
  db.prepare("DELETE FROM menus WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
