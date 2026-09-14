import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { pushSubscribeSchema } from "../schemas.js";
import { isPushConfigured } from "../lib/push.js";

export const pushRouter = Router();

pushRouter.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, configured: isPushConfigured() });
});

pushRouter.use(requireAuth);

pushRouter.post("/subscribe", validate(pushSubscribeSchema), (req, res) => {
  const { endpoint, keys } = req.body;
  db.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(nanoid(), req.userId, endpoint, keys.p256dh, keys.auth, new Date().toISOString());
  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
  res.json({ ok: true });
});
