import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireLease } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { slotCreateSchema, appointmentCreateSchema } from "../schemas.js";
import { notifyUsers } from "./notifications.js";
import { residenceIdForUser } from "../lib/residence.js";

export const slotsRouter = Router();
slotsRouter.use(requireAuth);

slotsRouter.get("/", (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const slots =
    req.userRole === "resident"
      ? db
          .prepare("SELECT * FROM availability_slots WHERE residence_id = ? AND is_booked = 0 AND start_at > ? ORDER BY start_at")
          .all(residenceId, new Date().toISOString())
      : db.prepare("SELECT * FROM availability_slots WHERE residence_id = ? ORDER BY start_at").all(residenceId);
  res.json({ slots });
});

slotsRouter.post("/", requireRole("manager"), validate(slotCreateSchema), (req, res) => {
  const slot = {
    id: nanoid(),
    staff_user_id: req.userId,
    residence_id: residenceIdForUser(req.userId),
    start_at: req.body.start_at,
    end_at: req.body.end_at,
    is_booked: 0,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO availability_slots (id, staff_user_id, residence_id, start_at, end_at, is_booked, created_at)
     VALUES (@id, @staff_user_id, @residence_id, @start_at, @end_at, @is_booked, @created_at)`
  ).run(slot);
  res.status(201).json({ slot });
});

slotsRouter.delete("/:id", requireRole("manager"), (req, res) => {
  const slot = db.prepare("SELECT * FROM availability_slots WHERE id = ?").get(req.params.id);
  if (!slot) return res.status(404).json({ error: "Créneau introuvable." });
  if (slot.is_booked) return res.status(409).json({ error: "Ce créneau est déjà réservé." });
  db.prepare("DELETE FROM availability_slots WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

const bookSlot = db.transaction((slotId, residentId, note) => {
  const slot = db.prepare("SELECT * FROM availability_slots WHERE id = ?").get(slotId);
  if (!slot) throw new Error("Créneau introuvable.");
  if (slot.is_booked) throw new Error("Ce créneau vient d'être réservé par quelqu'un d'autre.");

  db.prepare("UPDATE availability_slots SET is_booked = 1 WHERE id = ?").run(slotId);
  const appointment = {
    id: nanoid(),
    slot_id: slotId,
    resident_id: residentId,
    note,
    status: "confirme",
    created_at: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO appointments (id, slot_id, resident_id, note, status, created_at) VALUES (@id, @slot_id, @resident_id, @note, @status, @created_at)"
  ).run(appointment);
  return { appointment, slot };
});

appointmentsRouter.get("/", (req, res) => {
  const rows =
    req.userRole === "resident"
      ? db
          .prepare(
            `SELECT a.*, s.start_at, s.end_at FROM appointments a
             JOIN availability_slots s ON s.id = a.slot_id
             WHERE a.resident_id = ? ORDER BY s.start_at DESC`
          )
          .all(req.userId)
      : db
          .prepare(
            `SELECT a.*, s.start_at, s.end_at FROM appointments a
             JOIN availability_slots s ON s.id = a.slot_id
             ORDER BY s.start_at DESC`
          )
          .all();
  res.json({ appointments: rows });
});

appointmentsRouter.post("/", requireRole("resident"), requireLease, validate(appointmentCreateSchema), (req, res) => {
  try {
    const { appointment, slot } = bookSlot(req.body.slot_id, req.userId, req.body.note);

    notifyUsers([slot.staff_user_id], {
      title: "Nouveau rendez-vous",
      message: `Un résident a réservé un créneau le ${new Date(slot.start_at).toLocaleString("fr-FR")}.`,
      type: "info",
    });
    notifyUsers([req.userId], {
      title: "Rendez-vous confirmé",
      message: `Votre rendez-vous du ${new Date(slot.start_at).toLocaleString("fr-FR")} est confirmé.`,
      type: "info",
    });

    res.status(201).json({ appointment });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

appointmentsRouter.patch("/:id/cancel", (req, res) => {
  const appointment = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id);
  if (!appointment) return res.status(404).json({ error: "Rendez-vous introuvable." });
  if (req.userRole === "resident" && appointment.resident_id !== req.userId) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  db.prepare("UPDATE appointments SET status = 'annule' WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE availability_slots SET is_booked = 0 WHERE id = ?").run(appointment.slot_id);

  res.json({ appointment: db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id) });
});
