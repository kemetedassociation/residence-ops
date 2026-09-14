import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { buildingCreateSchema, buildingPatchSchema } from "../schemas.js";

export const buildingsRouter = Router();
buildingsRouter.use(requireAuth, requireRole("manager"));

buildingsRouter.post("/", validate(buildingCreateSchema), (req, res) => {
  const residence = db.prepare("SELECT * FROM residences LIMIT 1").get();
  if (!residence) return res.status(400).json({ error: "Aucune résidence configurée." });

  const building = { id: nanoid(), residence_id: residence.id, name: req.body.name, floors: req.body.floors };
  db.prepare("INSERT INTO buildings (id, residence_id, name, floors) VALUES (@id, @residence_id, @name, @floors)").run(building);
  db.prepare("UPDATE residences SET total_buildings = total_buildings + 1 WHERE id = ?").run(residence.id);

  res.status(201).json({ building });
});

buildingsRouter.put("/:id", validate(buildingPatchSchema), (req, res) => {
  const building = db.prepare("SELECT * FROM buildings WHERE id = ?").get(req.params.id);
  if (!building) return res.status(404).json({ error: "Bâtiment introuvable." });

  const updated = { ...building, ...req.body };
  db.prepare("UPDATE buildings SET name=@name, floors=@floors WHERE id=@id").run(updated);
  res.json({ building: db.prepare("SELECT * FROM buildings WHERE id = ?").get(req.params.id) });
});

buildingsRouter.delete("/:id", (req, res) => {
  const building = db.prepare("SELECT * FROM buildings WHERE id = ?").get(req.params.id);
  if (!building) return res.status(404).json({ error: "Bâtiment introuvable." });

  const inUse = db.prepare("SELECT COUNT(*) as n FROM incidents WHERE building_id = ?").get(req.params.id).n;
  if (inUse > 0) {
    return res.status(409).json({ error: "Impossible de supprimer : des incidents sont rattachés à ce bâtiment." });
  }

  db.prepare("DELETE FROM buildings WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE residences SET total_buildings = MAX(0, total_buildings - 1) WHERE id = ?").run(building.residence_id);
  res.status(204).end();
});
