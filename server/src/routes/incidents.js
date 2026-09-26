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
import { deletePrivateFile, fileIdFromUrl } from "./files.js";

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");

function deleteUploadedFile(url) {
  const privateId = fileIdFromUrl(url);
  if (privateId) return deletePrivateFile(privateId);
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(uploadsDir, path.basename(url));
  fs.unlink(filePath, () => {});
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

// `viewer` = { id, role } de la personne qui reçoit la réponse, ou null pour une diffusion à toute la
// résidence (temps réel). Les pièces jointes d'un signalement « privé » ne sont montrées qu'à son auteur
// et à la gestion/technicien : les autres résidents voient le signalement, sans ses pièces jointes.
function withPhotos(incident, viewer = null) {
  if (!incident) return incident;
  const canSeeAttachments =
    incident.photos_visibility === "public" ||
    (viewer && (viewer.id === incident.reporter_id || viewer.role === "manager" || viewer.role === "technicien"));
  const base = { ...incident, is_validated: !!incident.is_validated };

  const rows = db.prepare("SELECT url FROM incident_photos WHERE incident_id = ? ORDER BY created_at").all(incident.id);
  if (!canSeeAttachments) return { ...base, photo_urls: [], attachments: [], photos_hidden: rows.length > 0 };

  const attachments = rows.map(({ url }) => {
    const id = fileIdFromUrl(url);
    const file = id && db.prepare("SELECT original_name, mime FROM private_files WHERE id = ?").get(id);
    if (file) return { url, name: file.original_name, mime: file.mime };
    return { url, name: "Photo", mime: IMAGE_EXT.test(url) ? "image/jpeg" : "application/octet-stream" };
  });
  return { ...base, photo_urls: rows.map((r) => r.url), attachments, photos_hidden: false };
}

// Un fichier privé référencé ne peut l'être que par la personne qui l'a réellement déposé.
function ownsAttachment(url, userId) {
  const id = fileIdFromUrl(url);
  if (!id) return false;
  return db.prepare("SELECT 1 FROM private_files WHERE id = ? AND uploader_id = ?").get(id, userId) !== undefined;
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
  const viewer = { id: req.userId, role: req.userRole };
  res.json({ incidents: incidents.map((i) => withPhotos(i, viewer)) });
});

incidentsRouter.post("/", requireRole("resident"), requireLease, validate(incidentCreateSchema), (req, res) => {
  const { type, title, building_id, floor, room, description, priority, photo_urls } = req.body;
  const now = new Date().toISOString();

  const hasLegacyPublicFiles = photo_urls.some((u) => u.startsWith("/uploads/"));
  // Sans choix explicite : privé par défaut, sauf pour un ancien client qui n'envoie que des fichiers publics.
  const photos_visibility = req.body.photos_visibility ?? (hasLegacyPublicFiles ? "public" : "private");
  if (photos_visibility === "private" && hasLegacyPublicFiles) {
    return res.status(400).json({ error: "Les pièces jointes réservées à la gestion doivent passer par l'envoi sécurisé." });
  }
  if (photo_urls.some((u) => u.startsWith("/api/files/") && !ownsAttachment(u, req.userId))) {
    return res.status(400).json({ error: "Pièce jointe invalide." });
  }

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
    photos_visibility,
  };

  db.prepare(
    `INSERT INTO incidents (id, reporter_id, building_id, floor, room, type, title, description, status, priority, confirmation_count, is_validated, assigned_to, created_at, updated_at, resolved_date, photos_visibility)
     VALUES (@id, @reporter_id, @building_id, @floor, @room, @type, @title, @description, @status, @priority, @confirmation_count, @is_validated, @assigned_to, @created_at, @updated_at, @resolved_date, @photos_visibility)`
  ).run(incident);

  const insertPhoto = db.prepare("INSERT INTO incident_photos (id, incident_id, url, created_at) VALUES (?, ?, ?, ?)");
  photo_urls.forEach((url) => insertPhoto.run(nanoid(), incident.id, url, now));

  const residenceId = residenceIdForBuilding(building_id) || residenceIdForUser(req.userId);
  emitToResidence(residenceId, "incident:created", withPhotos(incident, null));

  if (priority === "urgent" && building_id) {
    notifyBuilding(
      building_id,
      { title: "Incident urgent signalé", message: `« ${incident.title} » vient d'être signalé.`, type: "alerte", link: `/?incident=${incident.id}` },
      { excludeUserId: req.userId }
    );
  }

  res.status(201).json({ incident: withPhotos(incident, { id: req.userId, role: req.userRole }) });
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
        link: `/?incident=${incident.id}`,
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
        link: `/?incident=${incident.id}`,
      });
      if (incident.building_id) {
        notifyBuilding(
          incident.building_id,
          { title: "Incident résolu", message: `« ${incident.title} » a été résolu.`, type: "resolution", link: `/?incident=${incident.id}` },
          { excludeUserId: incident.reporter_id }
        );
      }
    }
  }

  db.prepare(
    "UPDATE incidents SET status=@status, priority=@priority, assigned_to=@assigned_to, updated_at=@updated_at, resolved_date=@resolved_date WHERE id=@id"
  ).run(updates);

  const row = db.prepare("SELECT * FROM incidents WHERE id = ?").get(req.params.id);
  const residenceId = residenceIdForBuilding(incident.building_id);
  emitToResidence(residenceId, "incident:updated", withPhotos(row, null));

  res.json({ incident: withPhotos(row, { id: req.userId, role: req.userRole }) });
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
