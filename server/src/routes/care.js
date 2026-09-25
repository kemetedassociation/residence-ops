import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/db.js";
import { requireAuth, requireRole, requireCarePro, signCareToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notifyUsers } from "./notifications.js";
import { residenceIdForUser } from "../lib/residence.js";

export const careRouter = Router();

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const token = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
const limiter = (limit, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.VITEST ? 1000 : limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });
const proAuthLimiter = limiter(10, "Trop de tentatives, réessayez dans quelques minutes.");

const parse = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
};
const publicPro = (p) => ({
  id: p.id,
  name: p.name,
  title: p.title,
  specialties: parse(p.specialties),
  languages: parse(p.languages),
  bio: p.bio,
  phone: p.phone,
  email: p.email,
  address: p.address,
  mode: p.mode,
  free: !!p.free,
});

// ---------------------------------------------------------------------------------------------
// Calendrier (.ics)
// ---------------------------------------------------------------------------------------------
const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function icsEvent({ uid, start, end, summary, description = "", location = "", alarm = true }) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@residence-ops`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(summary)}`,
    description && `DESCRIPTION:${icsText(description)}`,
    location && `LOCATION:${icsText(location)}`,
    ...(alarm ? ["BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Rappel de rendez-vous", "END:VALARM"] : []),
    "END:VEVENT",
  ].filter(Boolean);
}

const icsCalendar = (name, events) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Residence Ops//Accompagnement//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsText(name)}`, ...events.flat(), "END:VCALENDAR"].join("\r\n") + "\r\n";

// ---------------------------------------------------------------------------------------------
// Annuaire public : accessible sans connexion (une personne en détresse ne doit pas être bloquée).
// ---------------------------------------------------------------------------------------------
careRouter.get("/professionals", (req, res) => {
  const rows = db.prepare("SELECT * FROM care_professionals WHERE active = 1 ORDER BY name").all();
  res.json({ professionals: rows.map(publicPro) });
});

// ---------------------------------------------------------------------------------------------
// Résident : créneaux, réservation, rendez-vous. Ouvert à tout résident connecté, MÊME sans bail
// vérifié : l'accès à l'aide ne dépend jamais d'une formalité administrative.
// ---------------------------------------------------------------------------------------------
const resident = [requireAuth, requireRole("resident")];

careRouter.get("/professionals/:id/slots", ...resident, (req, res) => {
  const pro = db.prepare("SELECT id FROM care_professionals WHERE id = ? AND active = 1").get(req.params.id);
  if (!pro) return res.status(404).json({ error: "Professionnel introuvable." });
  const slots = db
    .prepare("SELECT id, start_at, end_at FROM care_slots WHERE professional_id = ? AND is_booked = 0 AND start_at > ? ORDER BY start_at LIMIT 60")
    .all(pro.id, new Date(Date.now() + 60 * 60 * 1000).toISOString());
  res.json({ slots });
});

const bookSchema = z.object({
  slot_id: z.string().min(5).max(60),
  note: z.string().trim().max(500).optional().default(""),
  share_contact: z.boolean().optional().default(false),
});

const MAX_ACTIVE_APPOINTMENTS = 3;

const book = db.transaction((userId, { slot_id, note, share_contact }) => {
  const slot = db
    .prepare(
      "SELECT s.*, p.active FROM care_slots s JOIN care_professionals p ON p.id = s.professional_id WHERE s.id = ?"
    )
    .get(slot_id);
  if (!slot || !slot.active) return { error: "Créneau introuvable.", status: 404 };
  if (slot.is_booked || slot.start_at <= new Date(Date.now() + 60 * 60 * 1000).toISOString()) {
    return { error: "Ce créneau n'est plus disponible.", status: 409 };
  }
  const active = db
    .prepare(
      "SELECT COUNT(*) AS n FROM care_appointments a JOIN care_slots s ON s.id = a.slot_id WHERE a.resident_id = ? AND a.status = 'confirme' AND s.start_at > ?"
    )
    .get(userId, new Date().toISOString()).n;
  if (active >= MAX_ACTIVE_APPOINTMENTS) {
    return { error: `Vous avez déjà ${MAX_ACTIVE_APPOINTMENTS} rendez-vous à venir. Annulez-en un avant d'en prendre un nouveau.`, status: 409 };
  }
  // Réservation atomique : le créneau ne peut être pris que s'il est encore libre.
  const claimed = db.prepare("UPDATE care_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0").run(slot_id);
  if (claimed.changes !== 1) return { error: "Ce créneau n'est plus disponible.", status: 409 };

  const id = nanoid();
  db.prepare(
    "INSERT INTO care_appointments (id, slot_id, professional_id, resident_id, note, share_contact, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'confirme', ?)"
  ).run(id, slot_id, slot.professional_id, userId, note, share_contact ? 1 : 0, new Date().toISOString());
  return { id };
});

function appointmentView(id) {
  return db
    .prepare(
      `SELECT a.id, a.status, a.note, a.share_contact, s.start_at, s.end_at, p.id AS professional_id, p.name AS professional_name,
              p.title AS professional_title, p.mode, p.address, p.phone, p.email
       FROM care_appointments a JOIN care_slots s ON s.id = a.slot_id JOIN care_professionals p ON p.id = a.professional_id
       WHERE a.id = ?`
    )
    .get(id);
}

careRouter.post("/appointments", ...resident, validate(bookSchema), (req, res) => {
  const result = book(req.userId, req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  // Notification volontairement sans détail : rien de sensible dans les notifications système.
  notifyUsers([req.userId], { title: "Rendez-vous confirmé", message: "Votre rendez-vous est enregistré. Retrouvez-le dans « Besoin d'aide ».", type: "info" });
  res.status(201).json({ appointment: appointmentView(result.id) });
});

careRouter.get("/appointments/mine", ...resident, (req, res) => {
  const rows = db
    .prepare("SELECT id FROM care_appointments WHERE resident_id = ? AND status = 'confirme' ORDER BY created_at DESC")
    .all(req.userId)
    .map((r) => appointmentView(r.id))
    .filter((a) => a.end_at > new Date().toISOString())
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  res.json({ appointments: rows });
});

function ownAppointment(req, res) {
  const a = db.prepare("SELECT * FROM care_appointments WHERE id = ? AND resident_id = ?").get(req.params.id, req.userId);
  if (!a) res.status(404).json({ error: "Rendez-vous introuvable." });
  return a;
}

careRouter.patch("/appointments/:id/cancel", ...resident, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  db.transaction(() => {
    db.prepare("UPDATE care_appointments SET status = 'annule' WHERE id = ?").run(a.id);
    db.prepare("UPDATE care_slots SET is_booked = 0 WHERE id = ?").run(a.slot_id);
  })();
  res.json({ ok: true });
});

// Fichier d'agenda à importer (Apple Calendar, Outlook, Google Agenda...). Titre volontairement neutre :
// l'agenda personnel est souvent partagé ou visible sur l'écran d'un téléphone.
careRouter.get("/appointments/:id/ics", ...resident, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  const v = appointmentView(a.id);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="rendez-vous.ics"');
  res.setHeader("Cache-Control", "private, no-store");
  res.send(
    icsCalendar("Rendez-vous", [
      icsEvent({
        uid: `care-${v.id}`,
        start: v.start_at,
        end: v.end_at,
        summary: `Rendez-vous — ${v.professional_name}`,
        description: v.mode === "visio" ? "Consultation en visioconférence." : "",
        location: v.mode === "visio" ? "Visioconférence" : v.address,
      }),
    ])
  );
});

// ---------------------------------------------------------------------------------------------
// Professionnel de santé : activation de l'invitation, connexion, agenda, créneaux.
// La gestion de la résidence n'a AUCUNE de ces routes : elle ne voit jamais les rendez-vous.
// ---------------------------------------------------------------------------------------------
const claimSchema = z.object({
  invite_code: z.string().min(10).max(100),
  password: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères.").max(200),
});

function newFeedToken(proId) {
  const t = token(24);
  db.prepare("UPDATE care_professionals SET feed_token_hash = ? WHERE id = ?").run(sha(t), proId);
  return t;
}

careRouter.post("/pro/claim", proAuthLimiter, validate(claimSchema), (req, res) => {
  const pro = db
    .prepare("SELECT * FROM care_professionals WHERE invite_hash = ? AND access_hash IS NULL AND active = 1")
    .get(sha(req.body.invite_code));
  if (!pro || !pro.invite_expires_at || pro.invite_expires_at < new Date().toISOString()) {
    return res.status(400).json({ error: "Invitation invalide ou expirée. Demandez-en une nouvelle à la gestion." });
  }
  // Le code est à usage unique : une fois activé, la gestion n'a plus aucun moyen d'accéder à ce compte.
  db.prepare("UPDATE care_professionals SET access_hash = ?, invite_hash = NULL, invite_expires_at = NULL WHERE id = ?").run(
    bcrypt.hashSync(req.body.password, 10),
    pro.id
  );
  res.status(201).json({ token: signCareToken(pro), professional: publicPro(pro), feed_token: newFeedToken(pro.id) });
});

const proLoginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });

careRouter.post("/pro/login", proAuthLimiter, validate(proLoginSchema), (req, res) => {
  const pro = db.prepare("SELECT * FROM care_professionals WHERE lower(email) = lower(?) AND active = 1 AND access_hash IS NOT NULL").get(req.body.email);
  if (!pro || !bcrypt.compareSync(req.body.password, pro.access_hash)) return res.status(401).json({ error: "Identifiants incorrects." });
  res.json({ token: signCareToken(pro), professional: publicPro(pro) });
});

careRouter.get("/pro/me", requireCarePro, (req, res) => res.json({ professional: publicPro(req.pro) }));

careRouter.post("/pro/feed-token", requireCarePro, (req, res) => {
  res.json({ feed_token: newFeedToken(req.pro.id) });
});

careRouter.get("/pro/appointments", requireCarePro, (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db
    .prepare(
      `SELECT a.id, a.note, a.share_contact, a.status, s.start_at, s.end_at, u.name, u.email, u.phone, u.room
       FROM care_appointments a JOIN care_slots s ON s.id = a.slot_id JOIN users u ON u.id = a.resident_id
       WHERE a.professional_id = ? AND a.status = 'confirme' AND s.start_at > ? ORDER BY s.start_at`
    )
    .all(req.pro.id, since);
  res.json({
    appointments: rows.map((r) => ({
      id: r.id,
      start_at: r.start_at,
      end_at: r.end_at,
      note: r.note,
      // Le résident ne partage son e-mail/téléphone que s'il a coché la case.
      resident: { name: r.name, room: r.room, ...(r.share_contact ? { email: r.email, phone: r.phone } : {}) },
    })),
  });
});

careRouter.get("/pro/slots", requireCarePro, (req, res) => {
  const slots = db
    .prepare("SELECT id, start_at, end_at, is_booked FROM care_slots WHERE professional_id = ? AND start_at > ? ORDER BY start_at")
    .all(req.pro.id, new Date().toISOString());
  res.json({ slots });
});

const slotsSchema = z.object({
  slots: z
    .array(z.object({ start_at: z.string().datetime(), end_at: z.string().datetime() }))
    .min(1)
    .max(50),
});

careRouter.post("/pro/slots", requireCarePro, validate(slotsSchema), (req, res) => {
  const now = new Date().toISOString();
  const insert = db.prepare("INSERT INTO care_slots (id, professional_id, start_at, end_at, is_booked, created_at) VALUES (?, ?, ?, ?, 0, ?)");
  let created = 0;
  db.transaction(() => {
    for (const s of req.body.slots) {
      if (s.end_at <= s.start_at || s.start_at <= now) continue;
      const overlap = db
        .prepare("SELECT 1 FROM care_slots WHERE professional_id = ? AND start_at < ? AND end_at > ?")
        .get(req.pro.id, s.end_at, s.start_at);
      if (overlap) continue;
      insert.run(nanoid(), req.pro.id, s.start_at, s.end_at, now);
      created++;
    }
  })();
  res.status(201).json({ created });
});

careRouter.delete("/pro/slots/:id", requireCarePro, (req, res) => {
  const r = db.prepare("DELETE FROM care_slots WHERE id = ? AND professional_id = ? AND is_booked = 0").run(req.params.id, req.pro.id);
  if (r.changes === 0) return res.status(409).json({ error: "Créneau introuvable ou déjà réservé (annulez d'abord le rendez-vous)." });
  res.status(204).end();
});

careRouter.patch("/pro/appointments/:id/cancel", requireCarePro, (req, res) => {
  const a = db.prepare("SELECT * FROM care_appointments WHERE id = ? AND professional_id = ? AND status = 'confirme'").get(req.params.id, req.pro.id);
  if (!a) return res.status(404).json({ error: "Rendez-vous introuvable." });
  db.transaction(() => {
    db.prepare("UPDATE care_appointments SET status = 'annule' WHERE id = ?").run(a.id);
    db.prepare("UPDATE care_slots SET is_booked = 0 WHERE id = ?").run(a.slot_id);
  })();
  notifyUsers([a.resident_id], { title: "Rendez-vous annulé", message: "Votre rendez-vous a été annulé par le professionnel. Vous pouvez en choisir un autre.", type: "alerte" });
  res.json({ ok: true });
});

// Agenda partagé : adresse secrète à ajouter dans Google Agenda / Apple Calendar / Outlook
// (« S'abonner à un agenda »). Elle se met à jour toute seule à chaque nouveau rendez-vous.
careRouter.get("/feed/:token", (req, res) => {
  const pro = db.prepare("SELECT * FROM care_professionals WHERE feed_token_hash = ? AND active = 1").get(sha(req.params.token.replace(/\.ics$/, "")));
  if (!pro) return res.status(404).end();
  const rows = db
    .prepare(
      `SELECT a.id, a.note, a.share_contact, s.start_at, s.end_at, u.name, u.room, u.email, u.phone
       FROM care_appointments a JOIN care_slots s ON s.id = a.slot_id JOIN users u ON u.id = a.resident_id
       WHERE a.professional_id = ? AND a.status = 'confirme' AND s.start_at > ?`
    )
    .all(pro.id, new Date(Date.now() - 30 * 86400000).toISOString());
  const events = rows.map((r) =>
    icsEvent({
      uid: `care-${r.id}`,
      start: r.start_at,
      end: r.end_at,
      summary: `Consultation — ${r.name}`,
      description: [r.room && `Chambre ${r.room}`, r.share_contact && r.email, r.share_contact && r.phone, r.note].filter(Boolean).join("\n"),
    })
  );
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(icsCalendar(`Consultations — ${pro.name}`, events));
});

// ---------------------------------------------------------------------------------------------
// Gestionnaire : tenir l'annuaire. Voit des COMPTEURS, jamais d'identités ni de rendez-vous.
// ---------------------------------------------------------------------------------------------
const manager = [requireAuth, requireRole("manager")];

const proSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  specialties: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  languages: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  bio: z.string().trim().max(800).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().email().max(180),
  address: z.string().trim().max(240).default(""),
  mode: z.enum(["presentiel", "visio", "les_deux"]).default("les_deux"),
  free: z.boolean().default(false),
  active: z.boolean().optional(),
});

function managerView(p) {
  const counts = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN s.start_at > ? THEN 1 ELSE 0 END) AS upcoming
       FROM care_appointments a JOIN care_slots s ON s.id = a.slot_id WHERE a.professional_id = ? AND a.status = 'confirme'`
    )
    .get(new Date().toISOString(), p.id);
  const openSlots = db.prepare("SELECT COUNT(*) AS n FROM care_slots WHERE professional_id = ? AND is_booked = 0 AND start_at > ?").get(p.id, new Date().toISOString()).n;
  return { ...publicPro(p), active: !!p.active, claimed: !!p.access_hash, open_slots: openSlots, appointments_total: counts.total, appointments_upcoming: counts.upcoming || 0 };
}

function issueInvite(id) {
  const code = token(18);
  db.prepare("UPDATE care_professionals SET invite_hash = ?, invite_expires_at = ? WHERE id = ?").run(sha(code), new Date(Date.now() + 14 * 86400000).toISOString(), id);
  return code;
}

careRouter.get("/manage/professionals", ...manager, (req, res) => {
  res.json({ professionals: db.prepare("SELECT * FROM care_professionals ORDER BY name").all().map(managerView) });
});

careRouter.post("/manage/professionals", ...manager, validate(proSchema), (req, res) => {
  const b = req.body;
  const id = nanoid();
  db.prepare(
    `INSERT INTO care_professionals (id, residence_id, name, title, specialties, languages, bio, phone, email, address, mode, free, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, residenceIdForUser(req.userId), b.name, b.title, JSON.stringify(b.specialties), JSON.stringify(b.languages), b.bio, b.phone, b.email, b.address, b.mode, b.free ? 1 : 0, new Date().toISOString());
  const invite_code = issueInvite(id);
  res.status(201).json({ professional: managerView(db.prepare("SELECT * FROM care_professionals WHERE id = ?").get(id)), invite_code });
});

careRouter.patch("/manage/professionals/:id", ...manager, validate(proSchema.partial()), (req, res) => {
  const p = db.prepare("SELECT * FROM care_professionals WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Professionnel introuvable." });
  const b = { ...publicPro(p), active: !!p.active, ...req.body };
  db.prepare(
    "UPDATE care_professionals SET name=?, title=?, specialties=?, languages=?, bio=?, phone=?, email=?, address=?, mode=?, free=?, active=? WHERE id=?"
  ).run(b.name, b.title, JSON.stringify(b.specialties), JSON.stringify(b.languages), b.bio, b.phone, b.email, b.address, b.mode, b.free ? 1 : 0, b.active ? 1 : 0, p.id);
  res.json({ professional: managerView(db.prepare("SELECT * FROM care_professionals WHERE id = ?").get(p.id)) });
});

// Nouvelle invitation possible UNIQUEMENT tant que le professionnel n'a pas activé son accès : sinon la
// gestion pourrait s'approprier son compte et lire son agenda.
careRouter.post("/manage/professionals/:id/invite", ...manager, (req, res) => {
  const p = db.prepare("SELECT * FROM care_professionals WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Professionnel introuvable." });
  if (p.access_hash) return res.status(409).json({ error: "Ce professionnel a déjà activé son accès : une nouvelle invitation est impossible pour protéger la confidentialité de son agenda." });
  res.json({ invite_code: issueInvite(p.id) });
});

careRouter.delete("/manage/professionals/:id", ...manager, (req, res) => {
  const p = db.prepare("SELECT id FROM care_professionals WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Professionnel introuvable." });
  const affected = db.prepare("SELECT DISTINCT resident_id FROM care_appointments WHERE professional_id = ? AND status = 'confirme'").all(p.id).map((r) => r.resident_id);
  db.prepare("DELETE FROM care_professionals WHERE id = ?").run(p.id);
  if (affected.length) notifyUsers(affected, { title: "Rendez-vous annulé", message: "Un de vos rendez-vous a été annulé. Vous pouvez en choisir un autre dans « Besoin d'aide ».", type: "alerte" });
  res.status(204).end();
});
