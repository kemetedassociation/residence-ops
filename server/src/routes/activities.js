import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { activityCreateSchema, activityPatchSchema } from "../schemas.js";
import { residenceIdForUser } from "../lib/residence.js";
import { notifyResidence } from "./notifications.js";

export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);

activitiesRouter.get("/", (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const activities = db
    .prepare("SELECT * FROM activities WHERE residence_id = ? ORDER BY activity_date ASC, start_time ASC")
    .all(residenceId);
  res.json({ activities });
});

activitiesRouter.post("/", requireRole("manager"), validate(activityCreateSchema), (req, res) => {
  const residenceId = residenceIdForUser(req.userId);
  const activity = {
    id: nanoid(),
    residence_id: residenceId,
    ...req.body,
    created_by: req.userId,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO activities (id, residence_id, title, description, category, activity_date, start_time, end_time, location, created_by, created_at)
     VALUES (@id, @residence_id, @title, @description, @category, @activity_date, @start_time, @end_time, @location, @created_by, @created_at)`
  ).run(activity);

  notifyResidence(residenceId, {
    title: "Nouvelle activité",
    message: `« ${activity.title} » a été ajouté au planning des loisirs.`,
    type: "info",
    link: "/loisirs",
  });

  res.status(201).json({ activity });
});

activitiesRouter.put("/:id", requireRole("manager"), validate(activityPatchSchema), (req, res) => {
  const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(req.params.id);
  if (!activity) return res.status(404).json({ error: "Activité introuvable." });

  const updated = { ...activity, ...req.body };
  db.prepare(
    `UPDATE activities SET title=@title, description=@description, category=@category, activity_date=@activity_date,
     start_time=@start_time, end_time=@end_time, location=@location WHERE id=@id`
  ).run(updated);

  res.json({ activity: db.prepare("SELECT * FROM activities WHERE id = ?").get(req.params.id) });
});

activitiesRouter.delete("/:id", requireRole("manager"), (req, res) => {
  db.prepare("DELETE FROM activities WHERE id = ?").run(req.params.id);
  res.status(204).end();
});
