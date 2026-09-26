import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth } from "../middleware/auth.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "../lib/push.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// Un lien de notification est toujours un chemin interne de l'app (jamais une URL externe) : on évite
// ainsi qu'une notification serve de tremplin vers un site tiers.
export function sanitizeLink(link) {
  return typeof link === "string" && /^\/(?!\/)[\w\-/?=&%.]{0,200}$/.test(link) ? link : null;
}

export function notifyUsers(userIds, { title, message, type, target_building_id = null, link = null }) {
  const now = new Date().toISOString();
  const safeLink = sanitizeLink(link);
  const insert = db.prepare(
    `INSERT INTO notifications (id, user_id, title, message, type, target_building_id, link, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  );

  const created = userIds.filter(Boolean).map((userId) => {
    const id = nanoid();
    insert.run(id, userId, title, message, type, target_building_id, safeLink, now);
    const notif = { id, user_id: userId, title, message, type, target_building_id, link: safeLink, is_read: false, created_at: now };
    emitToUser(`user:${userId}`, "notification:created", notif);
    sendPushToUser(userId, { title, body: message, url: safeLink || "/notifications" });
    return notif;
  });

  return created;
}

export function notifyBuilding(buildingId, payload, { excludeUserId } = {}) {
  const users = db
    .prepare("SELECT id FROM users WHERE building_id = ? AND role = 'resident' AND id != COALESCE(?, '')")
    .all(buildingId, excludeUserId || null);
  return notifyUsers(
    users.map((u) => u.id),
    { ...payload, target_building_id: buildingId }
  );
}

export function notifyManagers(residenceId, payload) {
  const managers = db.prepare("SELECT id FROM users WHERE residence_id = ? AND role = 'manager'").all(residenceId);
  return notifyUsers(managers.map((u) => u.id), payload);
}

export function notifyResidence(residenceId, payload, { excludeUserId } = {}) {
  const users = db
    .prepare("SELECT id FROM users WHERE residence_id = ? AND role = 'resident' AND id != COALESCE(?, '')")
    .all(residenceId, excludeUserId || null);
  return notifyUsers(
    users.map((u) => u.id),
    payload
  );
}

notificationsRouter.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId)
    .map((n) => ({ ...n, is_read: !!n.is_read }));
  res.json({ notifications: items });
});

notificationsRouter.patch("/:id/read", (req, res) => {
  const notif = db.prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?").get(req.params.id, req.userId);
  if (!notif) return res.status(404).json({ error: "Notification introuvable." });
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
  res.json({ notification: { ...notif, is_read: true } });
});

notificationsRouter.patch("/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.userId);
  res.json({ ok: true });
});
