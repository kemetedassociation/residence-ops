import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { interventionCreateSchema, interventionPatchSchema } from "../schemas.js";
import { emitToResidence } from "../realtime.js";
import { residenceIdForBuilding } from "../lib/residence.js";
import { notifyUsers, notifyBuilding } from "./notifications.js";

export const interventionsRouter = Router();
interventionsRouter.use(requireAuth, requireRole("manager", "technicien"));

interventionsRouter.get("/", (req, res) => {
  const interventions = db.prepare("SELECT * FROM interventions ORDER BY scheduled_date ASC").all();
  res.json({ interventions });
});

interventionsRouter.post("/", requireRole("manager"), validate(interventionCreateSchema), (req, res) => {
  const { incident_id, technician_id, scheduled_date, notes } = req.body;

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident_id);
  if (!incident) return res.status(404).json({ error: "Incident introuvable." });

  const technician = technician_id ? db.prepare("SELECT * FROM users WHERE id = ?").get(technician_id) : null;
  const now = new Date().toISOString();
  const intervention = {
    id: nanoid(),
    incident_id,
    technician_id: technician_id || null,
    technician_name: technician?.name || "",
    technician_email: technician?.email || "",
    scheduled_date,
    status: "planifiee",
    notes,
    created_at: now,
  };

  db.prepare(
    `INSERT INTO interventions (id, incident_id, technician_id, technician_name, technician_email, scheduled_date, status, notes, created_at)
     VALUES (@id, @incident_id, @technician_id, @technician_name, @technician_email, @scheduled_date, @status, @notes, @created_at)`
  ).run(intervention);

  const residenceId = residenceIdForBuilding(incident.building_id);

  if (incident.status === "signale" || incident.status === "confirme") {
    db.prepare("UPDATE incidents SET status = 'en_cours', updated_at = ? WHERE id = ?").run(now, incident_id);
    emitToResidence(residenceId, "incident:updated", { ...db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident_id), is_validated: !!incident.is_validated });
  }
  if (!incident.assigned_to && technician_id) {
    db.prepare("UPDATE incidents SET assigned_to = ? WHERE id = ?").run(technician_id, incident_id);
  }

  notifyUsers([incident.reporter_id], {
    title: "Intervention planifiée",
    message: `Un technicien va intervenir pour « ${incident.title} ».`,
    type: "intervention",
    target_building_id: incident.building_id,
    link: `/?incident=${incident.id}`,
  });

  emitToResidence(residenceId, "intervention:created", intervention);
  res.status(201).json({ intervention });
});

interventionsRouter.patch("/:id", validate(interventionPatchSchema), (req, res) => {
  const intervention = db.prepare("SELECT * FROM interventions WHERE id = ?").get(req.params.id);
  if (!intervention) return res.status(404).json({ error: "Intervention introuvable." });

  const updated = { ...intervention, ...req.body };
  db.prepare("UPDATE interventions SET status=@status, notes=@notes, scheduled_date=@scheduled_date WHERE id=@id").run(updated);

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(intervention.incident_id);
  const residenceId = residenceIdForBuilding(incident?.building_id);

  if (req.body.status === "terminee" && incident) {
    const now = new Date().toISOString();
    db.prepare("UPDATE incidents SET status = 'resolu', resolved_date = ?, updated_at = ? WHERE id = ?").run(now, now, incident.id);

    notifyUsers([incident.reporter_id], {
      title: "Incident résolu",
      message: `Votre signalement « ${incident.title} » a été résolu.`,
      type: "resolution",
      target_building_id: incident.building_id,
      link: `/?incident=${incident.id}`,
    });
    if (incident.building_id) {
      notifyBuilding(
        incident.building_id,
        { title: "Incident résolu", message: `« ${incident.title} » a été résolu.`, type: "resolution", link: `/?incident=${incident.id}` },
        { excludeUserId: incident.reporter_id }
      );
    }

    emitToResidence(residenceId, "incident:updated", {
      ...db.prepare("SELECT * FROM incidents WHERE id = ?").get(incident.id),
      is_validated: !!incident.is_validated,
    });
  }

  emitToResidence(residenceId, "intervention:updated", updated);
  res.json({ intervention: updated });
});
