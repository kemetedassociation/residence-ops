import { Router } from "express";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { residencePatchSchema } from "../schemas.js";

export const residencesRouter = Router();

residencesRouter.get("/", (req, res) => {
  res.json({
    residences: db.prepare("SELECT * FROM residences").all(),
    buildings: db.prepare("SELECT * FROM buildings").all(),
  });
});

residencesRouter.put("/:id", requireAuth, requireRole("manager"), validate(residencePatchSchema), (req, res) => {
  const residence = db.prepare("SELECT * FROM residences WHERE id = ?").get(req.params.id);
  if (!residence) return res.status(404).json({ error: "Résidence introuvable." });

  const updated = { ...residence, ...req.body };
  db.prepare(
    `UPDATE residences
     SET name=@name, address=@address, city=@city, latitude=@latitude, longitude=@longitude,
         display_name=@display_name, logo_url=@logo_url, primary_color=@primary_color, plan=@plan
     WHERE id=@id`
  ).run(updated);

  res.json({ residence: db.prepare("SELECT * FROM residences WHERE id = ?").get(req.params.id) });
});
