import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { feedbackCreateSchema } from "../schemas.js";

export const feedbackRouter = Router();
feedbackRouter.use(requireAuth);

function maskEmail(email = "") {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name[0]}***@${domain}`;
}

feedbackRouter.get("/", (req, res) => {
  const { type } = req.query;
  let rows;
  if (type) {
    rows = db.prepare("SELECT * FROM feedback WHERE type = ? ORDER BY created_at DESC").all(type);
  } else if (req.userRole === "resident") {
    rows = db.prepare("SELECT * FROM feedback WHERE type = 'suggestion' ORDER BY created_at DESC").all();
  } else {
    rows = db.prepare("SELECT * FROM feedback ORDER BY created_at DESC").all();
  }

  const withAuthor = rows.map((f) => {
    const author = db.prepare("SELECT email FROM users WHERE id = ?").get(f.user_id);
    return { ...f, author_email_masked: maskEmail(author?.email), is_mine: f.user_id === req.userId };
  });

  res.json({ feedback: withAuthor });
});

feedbackRouter.post("/", requireRole("resident"), validate(feedbackCreateSchema), (req, res) => {
  const { message, type, title, rating, incident_id } = req.body;
  const item = {
    id: nanoid(),
    user_id: req.userId,
    type,
    title,
    message,
    rating: type === "satisfaction" ? rating || 5 : null,
    incident_id: incident_id || null,
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO feedback (id, user_id, type, title, message, rating, incident_id, created_at)
     VALUES (@id, @user_id, @type, @title, @message, @rating, @incident_id, @created_at)`
  ).run(item);

  res.status(201).json({ feedback: item });
});
