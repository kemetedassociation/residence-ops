import { Router } from "express";
import { nanoid } from "nanoid";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { incidentCreateSchema, incidentPatchSchema } from "../schemas.js";
import { emitToResidence } from "../realtime.js";
import { residenceIdForBuilding, residenceIdForUser } from "../lib/residence.js";
import { notifyUsers, notifyBuilding } from "./notifications.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

function deleteUploadedFile(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(uploadsDir, path.basename(url));
  fs.unlink(filePath, () => {});
}

function withPhotos(incident) {
  if (!incident) return incident;
  const photos = db.prepare("SELECT url FROM incident_photos WHERE incident_id = ? ORDER BY created_at").all(incident.id);
  return { ...incident, is_validated: !!incident.is_validated, photo_urls: photos.map((p) => p.url) };
}

incidentsRouter.get("/", (req, res) => {
  const { status, type, building_id, mine } = req.query;
  const clauses = [];
  const params = [];

  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (type) {
    clauses.push("type = ?");
    params.push(type);
  }
  if (building_id) {
    clauses.push("building_id = ?");
    params.push(building_id);
  }
  if (mine === "true") {
    clauses.push("reporter_id = ?");
    params.push(req.userId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const incidents = db.prepare(`SELECT * FROM incidents ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ incidents: incidents.map(withPhotos) });
});

incidentsRouter.post("/", requireRole("resident"), requireLease, validate(incidentCreateSchema), (req, res) => {
  const { type, title, building_id, floor, room, description, priority, photo_urls } = req.body;
  const now = new Date().toISOString();

  const incident = {
    id: nanoid(),
    reporter_id: req.userId,
    building_id: building_id || null,
    floor,
    room,
    type,
    title: title || description.slice(0, 60),
    description,
    status: "signale",
    priority,
    confirmation_count: 1,
    is_validated: 0,
    assigned_to: null,
    created_at: now,
    updated_at: now,
    resolved_date: null,
  };

  db.prepare(
    `INSERT INTO incidents (id, reporter_id, building_id, floor, room, type, title, description, status, priority, confirmation_count, is_validated, assigned_to, created_at, updated_at, resolved_date)
     VALUES (@id, @reporter_id, @building_id, @floor, @room, @type, @title, @description, @status, @priority, @confirmation_count, @is_validated, @assigned_to, @created_at, @updated_at, @resolved_date)`
  ).run(incident);

  const insertPhoto = db.prepare("INSERT INTO incident_photos (id, incident_id, url, created_at) VALUES (?, ?, ?, ?)");
  photo_urls.forEach((url) => insertPhoto.run(nanoid(), incident.id, url, now));

  const residenceId = residenceIdForBuilding(building_id) || residenceIdForUser(req.userId);
  const full = withPhotos(incident);
  emitToResidence(residenceId, "incident:created", full);

  if (priority === "urgent" && building_id) {
    notifyBuilding(
      building_id,
      { title: "Incident urgent signalé", message: `« ${incident.title} » vient d'être signalé.`, type: "alerte" },
      { excludeUserId: req.userId }
    );
  }

  res.status(201).json({ incident: full });
});

incidentsRouter.patch("/:id", requireRole("manager", "technicien"), validate(incidentPatchSchema), (req, res) => {
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident introuvable." });

  const { status, priority, assigned_to } = req.body;
  const now = new Date().toISOString();
  const updates = { ...incident, updated_at: now };

  if (priority) updates.priority = priority;

  if (assigned_to !== undefined && assigned_to !== incident.assigned_to) {
    updates.assigned_to = assigned_to;
    if (assigned_to && (updates.status === "signale" || updates.status === "confirme")) {
      updates.status = "en_cours";
    }

    if (assigned_to) {
      const technician = db.prepare("SELECT * FROM users WHERE id = ?").get(assigned_to);
      db.prepare(
        `INSERT INTO interventions (id, incident_id, technician_id, technician_name, technician_email, scheduled_date, status, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'planifiee', '', ?)`
      ).run(nanoid(), incident.id, assigned_to, technician?.name || "", technician?.email || "", now, now);

      notifyUsers([incident.reporter_id], {
        title: "Intervention planifiée",
        message: `Un technicien va intervenir pour « ${incident.title} ».`,
        type: "intervention",
        target_building_id: incident.building_id,
      });
    }
  }

  if (status && status !== incident.status) {
    updates.status = status;
    if (status === "resolu") {
      updates.resolved_date = now;
      notifyUsers([incident.reporter_id], {
        title: "Incident résolu",
        message: `Votre signalement « ${incident.title} » a été résolu.`,
        type: "resolution",
        target_building_id: incident.building_id,
      });
      if (incident.building_id) {
        notifyBuilding(
          incident.building_id,
          { title: "Incident résolu", message: `« ${incident.title} » a été résolu.`, type: "resolution" },
          { excludeUserId: incident.reporter_id }
        );
      }
    }
  }

  db.prepare(
    "UPDATE incidents SET status=@status, priority=@priority, assigned_to=@assigned_to, updated_at=@updated_at, resolved_date=@resolved_date WHERE id=@id"
  ).run(updates);

  const fresh = withPhotos(db.prepare("SELECT * FROM incidents WHERE id = ?").get(req.params.id));
  const residenceId = residenceIdForBuilding(incident.building_id);
  emitToResidence(residenceId, "incident:updated", fresh);

  res.json({ incident: fresh });
});

incidentsRouter.delete("/:id", requireRole("manager"), (req, res) => {
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident introuvable." });

  const photos = db.prepare("SELECT url FROM incident_photos WHERE incident_id = ?").all(req.params.id);
  photos.forEach((p) => deleteUploadedFile(p.url));

  db.prepare("DELETE FROM incidents WHERE id = ?").run(req.params.id);

  const residenceId = residenceIdForBuilding(incident.building_id);
  emitToResidence(residenceId, "incident:deleted", { id: req.params.id });

  res.status(204).end();
});
