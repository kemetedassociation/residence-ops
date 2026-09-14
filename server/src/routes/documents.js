import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { documentCreateSchema, documentPatchSchema } from "../schemas.js";
import { notifyUsers, notifyManagers } from "./notifications.js";
import { residenceIdForUser } from "../lib/residence.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get("/", (req, res) => {
  const rows =
    req.userRole === "resident"
      ? db.prepare("SELECT * FROM document_requests WHERE user_id = ? ORDER BY created_at DESC").all(req.userId)
      : db.prepare("SELECT * FROM document_requests ORDER BY created_at DESC").all();
  res.json({ documents: rows });
});

documentsRouter.post("/", requireRole("resident"), requireLease, validate(documentCreateSchema), (req, res) => {
  const now = new Date().toISOString();
  const doc = {
    id: nanoid(),
    user_id: req.userId,
    type: req.body.type,
    note: req.body.note,
    status: "demande",
    admin_note: "",
    file_url: null,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO document_requests (id, user_id, type, note, status, admin_note, file_url, created_at, updated_at)
     VALUES (@id, @user_id, @type, @note, @status, @admin_note, @file_url, @created_at, @updated_at)`
  ).run(doc);

  notifyManagers(residenceIdForUser(req.userId), {
    title: "Nouvelle demande de document",
    message: `Une demande (${req.body.type}) a été déposée.`,
    type: "info",
  });

  res.status(201).json({ document: doc });
});

documentsRouter.patch("/:id", requireRole("manager"), validate(documentPatchSchema), (req, res) => {
  const doc = db.prepare("SELECT * FROM document_requests WHERE id = ?").get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Demande introuvable." });

  const updated = { ...doc, ...req.body, updated_at: new Date().toISOString() };
  db.prepare(
    "UPDATE document_requests SET status=@status, admin_note=@admin_note, file_url=@file_url, updated_at=@updated_at WHERE id=@id"
  ).run(updated);

  if (req.body.status === "pret") {
    notifyUsers([doc.user_id], {
      title: "Document disponible",
      message: "Votre document est prêt et disponible dans l'application.",
      type: "info",
    });
  } else if (req.body.status === "refuse") {
    notifyUsers([doc.user_id], {
      title: "Demande de document refusée",
      message: req.body.admin_note || "Votre demande de document a été refusée.",
      type: "alerte",
    });
  }

  res.json({ document: db.prepare("SELECT * FROM document_requests WHERE id = ?").get(req.params.id) });
});
