import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { confirmationCreateSchema } from "../schemas.js";
import { emitToResidence } from "../realtime.js";
import { residenceIdForBuilding } from "../lib/residence.js";
import { notifyUsers, notifyBuilding } from "./notifications.js";

export const confirmationsRouter = Router();
confirmationsRouter.use(requireAuth, requireRole("resident"), requireLease);

const CONFIRMATION_THRESHOLD = 2;

confirmationsRouter.post("/", validate(confirmationCreateSchema), (req, res) => {
  const { incident_id } = req.body;

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident_id);
  if (!incident) return res.status(404).json({ error: "Incident introuvable." });
  if (incident.reporter_id === req.userId) {
    return res.status(400).json({ error: "Vous ne pouvez pas confirmer votre propre signalement." });
  }

  const already = db.prepare("SELECT id FROM confirmations WHERE incident_id = ? AND user_id = ?").get(incident_id, req.userId);
  if (already) {
    return res.status(409).json({ error: "Vous avez déjà confirmé cet incident." });
  }

  const now = new Date().toISOString();
  db.prepare("INSERT INTO confirmations (id, incident_id, user_id, created_at) VALUES (?, ?, ?, ?)").run(
    nanoid(),
    incident_id,
    req.userId,
    now
  );

  const newCount = incident.confirmation_count + 1;
  let newStatus = incident.status;
  let justValidated = false;
  const wasValidated = !!incident.is_validated;

  if (!wasValidated && newCount >= CONFIRMATION_THRESHOLD) {
    justValidated = true;
    if (newStatus === "signale") newStatus = "confirme";
  }

  db.prepare("UPDATE incidents SET confirmation_count = ?, is_validated = ?, status = ?, updated_at = ? WHERE id = ?").run(
    newCount,
    justValidated ? 1 : wasValidated ? 1 : 0,
    newStatus,
    now,
    incident_id
  );

  const fresh = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident_id);
  const full = { ...fresh, is_validated: !!fresh.is_validated };

  if (justValidated) {
    notifyUsers([incident.reporter_id], {
      title: "Incident confirmé",
      message: `Votre signalement « ${incident.title} » a été confirmé par la communauté.`,
      type: "alerte",
      target_building_id: incident.building_id,
      link: `/?incident=${incident.id}`,
    });
    if (incident.building_id) {
      notifyBuilding(
        incident.building_id,
        { title: "Incident confirmé", message: `« ${incident.title} » a été confirmé par la communauté.`, type: "alerte", link: `/?incident=${incident.id}` },
        { excludeUserId: incident.reporter_id }
      );
    }
  }

  emitToResidence(residenceIdForBuilding(incident.building_id), "incident:updated", full);
  res.status(201).json({ incident: full });
});
